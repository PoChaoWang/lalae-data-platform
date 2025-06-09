# connections/apis/google_oauth.py
import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.contrib import messages
from django.shortcuts import redirect, get_object_or_404
from django.views.generic import UpdateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse
from django.http import JsonResponse
from google.auth import default
from google.auth.exceptions import DefaultCredentialsError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from allauth.socialaccount.models import SocialToken, SocialAccount
from google.oauth2.credentials import Credentials
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
import json

from google.cloud import bigquery
import pandas as pd
from ..models import Connection

# Relative import for models within the same app 'connections'
from ..models import (
    Connection,
    GoogleAdsField
)

# For token refresh
from requests_oauthlib import OAuth2Session
from oauthlib.oauth2 import WebApplicationClient

logger = logging.getLogger(__name__)


def _get_required_scopes(data_source_name):
    """Helper function to get OAuth scopes based on data source."""
    base_scopes = [
        # "https://www.googleapis.com/auth/bigquery",
        # "https://www.googleapis.com/auth/bigquerydatatransfer",
        "https://www.googleapis.com/auth/bigquerydatatransfer.readonly",
        "https://www.googleapis.com/auth/bigquerydatatransfer.write",
        # "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/bigquery.insertdata",
        "https://www.googleapis.com/auth/bigquery.readonly",
    ]
    if data_source_name == "GOOGLE_ADS":
        base_scopes.append("https://www.googleapis.com/auth/adwords.readonly")
    elif data_source_name == "YOUTUBE_CHANNEL":
        base_scopes.append("https://www.googleapis.com/auth/youtube.readonly")
    elif data_source_name == "GOOGLE_PLAY":
        base_scopes.append("https://www.googleapis.com/auth/androidpublisher")
    elif data_source_name == "GOOGLE_AD_MANAGER":
        base_scopes.append("https://www.googleapis.com/auth/admanager")
    return base_scopes

def _verify_token_scopes(social_token, required_scopes):
    """驗證token是否包含所需的scopes"""
    try:
        credentials = Credentials(token=social_token.token)

        # 使用OAuth2 API檢查token的scopes
        oauth2_service = build("oauth2", "v2", credentials=credentials)
        token_info = oauth2_service.tokeninfo().execute()

        # 檢查現有scopes
        current_scopes_str = token_info.get("scope", "")
        current_scopes = current_scopes_str.split() if current_scopes_str else []

        # 檢查是否缺少必要的scopes
        missing_scopes = []
        for scope in required_scopes:
            if scope not in current_scopes:
                missing_scopes.append(scope)

        if missing_scopes:
            logger.warning(
                f"Missing scopes for user {social_token.account.user.id}: {missing_scopes}"
            )
            logger.info(f"Current scopes: {current_scopes}")
            return False, missing_scopes

        logger.info(
            f"All required scopes present for user {social_token.account.user.id}"
        )
        return True, []

    except Exception as e:
        logger.error(f"Failed to verify token scopes: {str(e)}")
        return False, required_scopes

def _refresh_user_social_token(social_token, request=None):
    """Helper function to refresh an expired user access token."""
    try:
        # 檢查是否有 refresh token
        if not social_token.token_secret:
            logger.error(
                f"No refresh token available for user {social_token.account.user.id}"
            )
            return False

        logger.info(f"Refreshing token for user {social_token.account.user.id}")

        # 使用refresh token獲取新的access token
        from google.auth.transport.requests import Request

        credentials = Credentials(
            token=social_token.token,
            refresh_token=social_token.token_secret,
            client_id=social_token.app.client_id,
            client_secret=social_token.app.secret,
            token_uri="https://oauth2.googleapis.com/token",
        )

        # 刷新token
        credentials.refresh(Request())

        # 更新存儲的token
        social_token.token = credentials.token
        if credentials.expiry:
            social_token.expires_at = credentials.expiry
        social_token.save()

        logger.info(
            f"Token refreshed successfully for user {social_token.account.user.id}"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to refresh token: {str(e)}")
        if request:
            messages.error(
                request, "Failed to refresh authentication token. Please re-authorize."
            )
        return False

def _handle_insufficient_scopes(connection_instance, missing_scopes, request=None):
    """處理權限不足的情況，引導用戶重新授權"""
    logger.warning(
        f"Insufficient scopes for connection {connection_instance.pk}. Missing: {missing_scopes}"
    )

    if request:
        messages.warning(
            request,
            f"Additional permissions needed for {connection_instance.data_source.name}. "
            "Please re-authorize to grant the required permissions.",
        )
        # 儲存連接ID以便重新授權後關聯
        request.session["reauth_connection_pk"] = connection_instance.pk
        request.session["required_scopes"] = missing_scopes

        # 重定向到重新授權
        return redirect("socialaccount_login", provider="google")

    return False

def oauth_authorize(request, pk):
    """
    Handles manual OAuth authorization redirect for a connection.
    Enhanced to handle scope requirements.
    """
    connection = get_object_or_404(Connection, pk=pk, user=request.user)

    try:
        social_account = SocialAccount.objects.get(user=request.user, provider="google")

        # 檢查是否已經連結
        if connection.social_account == social_account:
            # 驗證 scopes
            try:
                social_token = SocialToken.objects.get(account=social_account)
                required_scopes = _get_required_scopes(connection.data_source.name)
                scopes_valid, missing_scopes = _verify_token_scopes(
                    social_token, required_scopes
                )

                if not scopes_valid:
                    messages.warning(
                        request,
                        f"Additional permissions needed for {connection.data_source.name}. "
                        "Please re-authorize to grant the required permissions.",
                    )
                    request.session["reauth_connection_pk"] = pk
                    request.session["required_scopes"] = missing_scopes
                    return redirect(
                        f"{reverse('account_login')}?process=connect&provider=google&next={reverse('connections:oauth_callback')}&scope={' '.join(required_scopes)}"
                    )
                else:
                    messages.success(
                        request,
                        "Google account is already properly linked with all required permissions.",
                    )
                    return redirect("connections:connection_detail", pk=connection.pk)

            except SocialToken.DoesNotExist:
                messages.error(
                    request, "No authentication token found. Please re-authorize."
                )
                request.session["oauth_connection_pk_to_link"] = pk
                return redirect(
                    f"{reverse('account_login')}?process=connect&provider=google&next={reverse('connections:oauth_callback')}"
                )
        else:
            connection.social_account = social_account
            connection.save(update_fields=["social_account"])
            messages.success(
                request, "Successfully linked your Google account to the connection."
            )
            return redirect("connections:connection_detail", pk=connection.pk)

    except SocialAccount.DoesNotExist:
        messages.info(
            request,
            "Please authorize with Google to link your account to this connection.",
        )
        request.session["oauth_connection_pk_to_link"] = pk
        return redirect(
            f"{reverse('account_login')}?process=connect&provider=google&next={reverse('connections:oauth_callback')}"
        )

def check_auth_status(request):
    """檢查使用者的 Google 授權狀態"""
    try:
        social_account = SocialAccount.objects.get(user=request.user, provider="google")
        social_token = SocialToken.objects.filter(
            account=social_account, app__provider="google"
        ).first()

        is_authorized = bool(
            social_token
            and (
                not social_token.expires_at or social_token.expires_at > timezone.now()
            )
        )

        return JsonResponse(
            {
                "is_authorized": is_authorized,
                "email": (
                    social_account.extra_data.get("email", "") if is_authorized else ""
                ),
            }
        )
    except SocialAccount.DoesNotExist:
        return JsonResponse({"is_authorized": False, "email": ""})

def build_custom_gaql(config, date_range_str="LAST_30_DAYS"):
    """根據 connection.config 動態生成 GAQL。"""
    resource = config.get("resource_name")
    metrics = config.get("metrics", [])
    segments = config.get("segments", [])

    if not resource or not metrics:
        raise ValueError("Resource name and at least one metric are required.")

    all_fields = metrics + segments
    if 'segments.date' not in all_fields:
        all_fields.append('segments.date')
    select_clause = ", ".join(sorted(list(set(all_fields)))) # 排序並移除重複

    query = f"SELECT {select_clause} FROM {resource} WHERE segments.date DURING {date_range_str}"
    logger.info(f"Built GAQL: {query}")
    return query

def save_results_to_bigquery(results, project_id, dataset_id, table_name):
    """將 Google Ads API 的查詢結果轉換為 Pandas DataFrame 並上傳到 BigQuery。"""
    if not results:
        logger.info("No results to save to BigQuery.")
        return True, "No data returned from Google Ads for the selected period."

    try:
        client = bigquery.Client(project=project_id)
        rows_list = []
        for batch in results:
            for row in batch.results:
                row_dict = {}
                for field_name, value in row._pb.items():
                    # 簡單地將 . 換成 _ 以符合 BigQuery 欄位命名規則
                    formatted_name = field_name.replace('.', '_')
                    row_dict[formatted_name] = value
                rows_list.append(row_dict)
        
        if not rows_list:
            return True, "Query returned no rows."

        df = pd.DataFrame(rows_list)
        
        for col in df.columns:
            if 'cost_micros' in col or 'cpc_micros' in col:
                df[col] = df[col] / 1_000_000

        table_id = f"{project_id}.{dataset_id}.{table_name}"
        job_config = bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE")
        job = client.load_table_from_dataframe(df, table_id, job_config=job_config)
        job.result()
        msg = f"Successfully loaded {len(df)} rows to {table_id}."
        logger.info(msg)
        return True, msg
    except Exception as e:
        logger.error(f"Failed to save to BigQuery: {e}", exc_info=True)
        return False, f"Failed to save to BigQuery: {e}"
    
def run_custom_gaql_and_save(connection_instance, request=None):
    """新的主要執行函式，取代 setup_dts_transfer。"""
    try:
        social_account = connection_instance.social_account
        if not social_account: return False, "Connection lacks a linked Google account."
        
        social_token = SocialToken.objects.get(account=social_account)
        
        if social_token.expires_at and social_token.expires_at <= timezone.now():
            if not _refresh_user_social_token(social_token, request):
                return False, "Failed to refresh expired token."
        
        google_ads_config = {
            "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
            "client_id": social_token.app.client_id,
            "client_secret": social_token.app.secret,
            "refresh_token": social_token.token_secret,
            "login_customer_id": connection_instance.config.get("customer_id"),
            "use_proto_plus": True
        }
        
        google_ads_client = GoogleAdsClient.load_from_dict(google_ads_config)
        google_ads_service = google_ads_client.get_service("GoogleAdsService")
        gaql_query = build_custom_gaql(connection_instance.config)
        customer_id = connection_instance.config.get("customer_id")
        
        search_request = google_ads_client.get_type("SearchGoogleAdsStreamRequest")
        search_request.customer_id = customer_id
        search_request.query = gaql_query
        
        stream = google_ads_service.search_stream(request=search_request)

        # 建立一個唯一的 table_name
        table_name = f"ga_custom_{connection_instance.id}"
        
        return save_results_to_bigquery(
            stream,
            settings.GOOGLE_CLOUD_PROJECT_ID,
            connection_instance.target_dataset_id,
            table_name
        )

    except GoogleAdsException as ex:
        errors = ". ".join([e.message for e in ex.failure.errors])
        logger.error(f"GAQL request failed: {errors}")
        return False, f"Google Ads API Error: {errors}"
    except Exception as e:
        logger.error(f"Unexpected error in run_custom_gaql_and_save: {e}", exc_info=True)
        return False, f"An unexpected error occurred: {e}"

def get_google_ads_page_context(client):
    
    context = {
        'oauth_status': 'not_authorized',
        'google_account_email': '',
        'google_fields_json': '{}'
    }

    # --- 1. 檢查授權狀態 ---

    if client and client.is_oauth_authorized():
        context['oauth_status'] = 'authorized'
        if client.google_social_account and hasattr(client.google_social_account, 'extra_data'):
            context['google_account_email'] = client.google_social_account.extra_data.get('email', '')

    # --- 2. 準備 Google Ads 欄位資料 ---
    try:
        fields = GoogleAdsField.objects.all()
        fields_tree = {}
        for field in fields:
            parts = field.field_name.split('.')
            current_level = fields_tree
            for part in parts[:-1]:
                if part not in current_level:
                    current_level[part] = {}
                current_level = current_level[part]
            leaf_key = parts[-1]
            current_level[leaf_key] = {
                "_is_leaf": True,
                "full_name": field.field_name,
                "display_name": field.display_name or field.field_name
            }
        context['google_fields_json'] = json.dumps(fields_tree)
        logger.info(f"Successfully built a nested tree context with {len(fields)} Google Ads fields.")
    except Exception as e:
        logger.error(f"Failed to build Google Ads fields tree context: {e}", exc_info=True)

    
    return context

def get_google_credentials(client_id, user):
    try:
        social_account = SocialAccount.objects.get(user=user, provider='google')
        token = SocialToken.objects.get(account=social_account)

        # Check if the token is expired and refresh if necessary
        if token.expires_at < timezone.now():
            client = WebApplicationClient(settings.GOOGLE_ADS_CLIENT_ID)
            
            # Use the correct key for refresh_token
            extra_data = social_account.extra_data
            refresh_token = extra_data.get('refresh_token', token.token_secret) # token_secret is often used for refresh_token

            if not refresh_token:
                logger.error(f"No refresh token available for user {user.id} to refresh Google Ads token.")
                # Here you might want to raise an exception or prompt for re-authentication
                return None

            google_oauth_session = OAuth2Session(
                client_id=settings.GOOGLE_ADS_CLIENT_ID,
                token={'refresh_token': refresh_token},
                auto_refresh_url=settings.GOOGLE_ADS_TOKEN_URI,
                auto_refresh_kwargs={
                    'client_id': settings.GOOGLE_ADS_CLIENT_ID,
                    'client_secret': settings.GOOGLE_ADS_CLIENT_SECRET,
                }
            )

            try:
                refreshed_token_data = google_oauth_session.refresh_token(
                    token_url=settings.GOOGLE_ADS_TOKEN_URI,
                    refresh_token=refresh_token
                )

                # Update the token in the database
                token.token = refreshed_token_data['access_token']
                token.token_secret = refreshed_token_data.get('refresh_token', refresh_token) # Persist the refresh token
                token.expires_at = timezone.now() + timedelta(seconds=refreshed_token_data['expires_in'])
                token.save()
                
                logger.info(f"Successfully refreshed Google Ads token for user {user.id}")

            except Exception as e:
                logger.error(f"Error refreshing Google Ads token for user {user.id}: {e}", exc_info=True)
                # Depending on the error, you might need to re-authenticate the user
                return None

        credentials = Credentials(
            token=token.token,
            refresh_token=token.token_secret, # Assuming token_secret holds the refresh token
            token_uri=settings.GOOGLE_ADS_TOKEN_URI,
            client_id=settings.GOOGLE_ADS_CLIENT_ID,
            client_secret=settings.GOOGLE_ADS_CLIENT_SECRET,
            scopes=_get_required_scopes('GOOGLE_ADS')
        )
        return credentials

    except SocialAccount.DoesNotExist:
        logger.error(f"User {user.id} has not connected their Google account.")
    except SocialToken.DoesNotExist:
        logger.error(f"SocialToken not found for Google account of user {user.id}.")
    except Exception as e:
        logger.error(f"An unexpected error occurred in get_google_credentials: {e}", exc_info=True)
    
    return None

class GoogleAdsAPIClient:
    def __init__(self, connection):
        self.connection = connection
        self.client = self._get_client()

    def _get_client(self):
        social_account = self.connection.social_account
        if not social_account:
            raise Exception("Connection lacks a linked Google account.")
        
        social_token = SocialToken.objects.get(account=social_account)
        
        # 在初始化時就檢查並刷新 token
        if social_token.expires_at and social_token.expires_at <= timezone.now():
            if not _refresh_user_social_token(social_token):
                raise Exception("Failed to refresh expired Google Ads token.")
        
        google_ads_config = {
            "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
            "client_id": social_token.app.client_id,
            "client_secret": social_token.app.secret,
            "refresh_token": social_token.token_secret,
            "login_customer_id": self.connection.config.get("customer_id"),
            "use_proto_plus": True
        }
        return GoogleAdsClient.load_from_dict(google_ads_config)

    def run_query_and_save(self):
        try:
            google_ads_service = self.client.get_service("GoogleAdsService")
            gaql_query = build_custom_gaql(self.connection.config)
            customer_id = self.connection.config.get("customer_id")
            
            search_request = self.client.get_type("SearchGoogleAdsStreamRequest")
            search_request.customer_id = customer_id
            search_request.query = gaql_query
            
            stream = google_ads_service.search_stream(request=search_request)
            table_name = f"ga_custom_{self.connection.id}"
            
            return save_results_to_bigquery(
                stream,
                settings.GOOGLE_CLOUD_PROJECT_ID,
                self.connection.target_dataset_id,
                table_name
            )
        except GoogleAdsException as ex:
            errors = ". ".join([e.message for e in ex.failure.errors])
            return False, f"Google Ads API Error: {errors}"
        except Exception as e:
            return False, f"An unexpected error occurred: {e}"
