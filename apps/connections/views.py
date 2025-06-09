# connections/views.py
import logging
import urllib.parse
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import (
    ListView,
    DetailView,
    CreateView,
    UpdateView,
    DeleteView,
    TemplateView,
)
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy, reverse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.utils import timezone
from django.http import JsonResponse
from django.views import View
from django.views.decorators.http import require_http_methods
import facebook
import requests # Add this for Facebook OAuth token exchange
from allauth.socialaccount.models import SocialApp
# Google specific (minimal, only for what's left in views)
from google.auth import default
from googleapiclient.discovery import build
from google.ads.googleads.client import GoogleAdsClient

from allauth.socialaccount.models import SocialAccount, SocialToken
from allauth.socialaccount.providers.oauth2.views import OAuth2CallbackView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
import json
# from apps.clients.models import Client # Already imported below

# App-specific imports
from .models import Connection, DataSource, GoogleAdsField 
from django.db.models import Q
from .forms import BaseConnectionForm, GoogleAdsForm, FacebookAdsForm
from apps.clients.models import Client  # Assuming this path is correct

# Import refactored OAuth and DTS logic from apis/google_oauth.py
from .apis.google_oauth import (
    oauth_authorize as api_oauth_authorize,
    _refresh_user_social_token,
    run_custom_gaql_and_save,
    get_google_ads_page_context   
)

# Import Facebook Ads API client
from .apis.facebook_ads import (
    FacebookAdsAPIClient, 
    get_facebook_ads_page_context, # This will be used
    get_facebook_oauth_url,
    
)

from .tasks import sync_connection_data_task

logger = logging.getLogger(__name__)


class ConnectionListView(LoginRequiredMixin, ListView):
    model = Connection
    template_name = "connections/connection_list.html"
    context_object_name = "connections"

    def get_queryset(self):
        return Connection.objects.select_related('client', 'data_source', 'social_account').filter(user=self.request.user).order_by("-created_at")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        facebook_connections = self.get_queryset().filter(
            data_source__name="FACEBOOK_ADS"
        )
        context["facebook_connections"] = facebook_connections
        return context


class SelectClientView(LoginRequiredMixin, TemplateView):
    template_name = "connections/select_dataset.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["clients"] = Client.objects.all()
        return context


class SelectDataSourceView(LoginRequiredMixin, TemplateView):
    template_name = "connections/select_data_source.html"

    def get(self, request, *args, **kwargs):
        client_id = request.GET.get("client_id")
        dataset_id = request.GET.get("dataset_id")

        if not client_id or not dataset_id:
            messages.warning(request, "Please select a client first.")
            return redirect("connections:select_dataset")

        try:
            client = Client.objects.get(id=client_id)
            request.session["selected_client_id"] = str(client.id)
            request.session["selected_dataset_id"] = dataset_id
        except Client.DoesNotExist:
            messages.warning(
                request, "Selected client not found. Please select a client first."
            )
            return redirect("connections:select_dataset")

        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["data_sources"] = DataSource.objects.filter(
            name__in=["GOOGLE_ADS", "FACEBOOK_ADS"]
        )
        client_id = self.request.GET.get("client_id")
        dataset_id = self.request.GET.get("dataset_id")

        try:
            client = Client.objects.get(id=client_id)
            context["client"] = client
            context["dataset_id"] = dataset_id
            context["client_id"] = str(client.id)
        except Client.DoesNotExist:
            pass
        return context

class ConnectionCreateView(LoginRequiredMixin, CreateView):
    model = Connection
    template_name = "connections/connection_form.html"

    def get_initial(self):
        initial = super().get_initial()
        dataset_id = self.request.session.get('selected_dataset_id')
        
        if dataset_id:
            initial['target_dataset_id'] = dataset_id
            
        return initial

    # 1. 表單工廠：根據 URL 決定使用哪個 Form Class
    def get_form_class(self):
        source_name = self.kwargs.get("source_name")
        if source_name == 'GOOGLE_ADS':
            return GoogleAdsForm
        elif source_name == 'FACEBOOK_ADS':
            return FacebookAdsForm
        else:
            return BaseConnectionForm

    # 2. 準備動態資料並傳遞給 Form 的 __init__ 方法
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        kwargs['request'] = self.request
        
        source_name = self.kwargs.get("source_name")
        data_source = get_object_or_404(DataSource, name=source_name)
        kwargs['data_source_instance'] = data_source

        # 如果是 Facebook，我們需要準備 ad_accounts 的選項並傳給 form
        if source_name == 'FACEBOOK_ADS':
            print("start to get form")
            client_id = self.kwargs.get("client_id")
            client = get_object_or_404(Client, id=client_id)
            ad_accounts = []
            
            # 從 SocialAccount 中安全地獲取 token
            if client.facebook_social_account:
                try:
                    # 這裡的邏輯是為了獲取 token
                    token_obj = SocialToken.objects.get(account=client.facebook_social_account, app__provider='facebook')
                    fb_client = FacebookAdsAPIClient(
                        app_id=settings.FACEBOOK_APP_ID,
                        app_secret=settings.FACEBOOK_APP_SECRET,
                        access_token=token_obj.token
                    )
                    ad_accounts = fb_client.get_ad_accounts()
                except SocialToken.DoesNotExist:
                    messages.error(self.request, "Facebook token not found. Please re-authorize the client.")
                except Exception as e:
                    logger.error(f"Failed to get FB Ad Accounts for form: {e}")
                    messages.error(self.request, "Failed to retrieve Facebook Ad Accounts.")

            # 將 ad_accounts 轉換為 (value, label) 格式並傳遞
            kwargs['facebook_ad_accounts_choices'] = [(acc['id'], f"{acc['name']} ({acc['id']})") for acc in ad_accounts]

            # 未來如果 GoogleAdsForm 需要動態選項，也可以在這裡加入
            # elif source_name == 'GOOGLE_ADS':
            #    kwargs['some_google_choices'] = get_google_choices()
            
        return kwargs

    # 3. 準備給 Template 使用的上下文資料
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        client_id = self.kwargs.get("client_id")
        client = get_object_or_404(Client, id=client_id)
        source_name = self.kwargs.get("source_name")
        context["client_id"] = str(client_id)
        context['data_source'] = get_object_or_404(DataSource, name=source_name)
        context['client'] = client
        context["dataset_id"] = self.request.GET.get("dataset_id") or self.request.session.get("selected_dataset_id")
        
        try:
            if source_name == "FACEBOOK_ADS":
                # ... (您現有的 Facebook 邏輯保持不變) ...
                user_fb_token = None
                if client.facebook_social_account:
                    # ...
                    pass
                facebook_page_context = get_facebook_ads_page_context(user_access_token=user_fb_token)
                context.update(facebook_page_context)

            elif source_name == "GOOGLE_ADS":
                # 呼叫我們重構後的函式
                google_page_context = get_google_ads_page_context(client)
                context.update(google_page_context)

        except Client.DoesNotExist:
            messages.error(self.request, "Selected client not found.")
            return redirect("connections:select_dataset")
        
        return context

    def form_invalid(self, form):
        print("================== FORM IS INVALID ==================")
        print(form.errors.as_json()) 
        print("===================================================")
        return super().form_invalid(form)

    # 4. 處理表單提交的核心邏輯
    def form_valid(self, form):
        """
        這個方法只會在表單通過所有基礎驗證後 (form.is_valid() == True) 才被呼叫。
        """
        logger.info(f"form_valid() called for source: {self.kwargs.get('source_name')}")

        # 1. 基本設定：獲取必要的物件
        # ==================================
        client = get_object_or_404(Client, id=self.kwargs.get("client_id"))
        form.instance.client = client
        form.instance.status = "PENDING"
        
        try:
            self.object = form.save()
        except Exception as e:
            logger.error(f"An unexpected error occurred during form.save(): {e}", exc_info=True)
            form.add_error(None, f"An unexpected error occurred while saving the connection: {e}")
            return self.form_invalid(form)
        source_name = self.kwargs.get("source_name")

        # 2. 連線前測試 (選擇性，但建議)
        # ==================================
        # 對於需要權杖的服務，可以在儲存前先測試一下 API 是否能通
        if source_name == "FACEBOOK_ADS":
            if not client.facebook_social_account:
                form.add_error(None, "This client does not have a linked Facebook account. Please authorize it first.")
                return self.form_invalid(form)

            try:
                logger.info("Performing Facebook API connection test...")
                token_obj = SocialToken.objects.get(account=client.facebook_social_account, app__provider='facebook')
                fb_client = FacebookAdsAPIClient(
                    app_id=settings.FACEBOOK_APP_ID,
                    app_secret=settings.FACEBOOK_APP_SECRET,
                    access_token=token_obj.token,
                    ad_account_id=form.cleaned_data.get('facebook_ad_account_id')
                )
                # 執行一個輕量的 API 請求作為測試，例如獲取廣告帳戶的名稱
                fb_client.get_insights(fields=['campaign_name'], date_preset='yesterday')
                logger.info("Facebook API connection test PASSED.")
            except Exception as e:
                logger.error(f"Facebook API connection test FAILED: {e}", exc_info=True)
                # 將詳細的技術錯誤記錄下來，但只給使用者一個友善的提示
                form.add_error(None, f"Connection test to Facebook failed. Please check your account permissions or try re-authorizing. Error: {e}")
                return self.form_invalid(form)

        elif source_name == "GOOGLE_ADS":
            if not client.is_oauth_authorized():
                form.add_error(None, "Google account is not authorized for this client.")
                return self.form_invalid(form)
            try:
                logger.info("Performing Google Ads API connection test...")
                social_token = SocialToken.objects.get(account=client.google_social_account)
                
                # 確保 token 是最新的，以防測試因 token 過期而失敗
                _refresh_user_social_token(social_token)
                
                # 建立一個臨時的 Google Ads Client 來進行測試
                google_ads_config = {
                    "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
                    "client_id": social_token.app.client_id,
                    "client_secret": social_token.app.secret,
                    "refresh_token": social_token.token_secret,
                    # 使用表單中使用者剛填寫的 customer_id
                    "login_customer_id": form.cleaned_data.get("customer_id"), 
                    "use_proto_plus": True
                }
                google_ads_client = GoogleAdsClient.load_from_dict(google_ads_config)
                customer_service = google_ads_client.get_service("CustomerService")
                
                # 執行一個輕量的 API 請求，例如列出可存取的客戶，來驗證憑證是否有效
                accessible_customers = customer_service.list_accessible_customers()
                logger.info("Google Ads API connection test PASSED.")

            except Exception as e:
                logger.error(f"Google Ads API connection test FAILED: {e}", exc_info=True)
                form.add_error(None, f"Connection test to Google Ads failed. Please check credentials and permissions. Error: {e}")
                return self.form_invalid(form)



        try:
            # 呼叫 form.save()，這會根據情況觸發 GoogleAdsForm 或 FacebookAdsForm 的 save 方法
            self.object = form.save()
            logger.info(f"Connection object {self.object.pk} created successfully in the database.")
            messages.success(self.request, f"Connection '{self.object.display_name}' was created successfully.")
        except Exception as e:
            # 防禦性程式碼，以防在 form.save() 內部發生未預期的錯誤
            logger.error(f"An unexpected error occurred during form.save(): {e}", exc_info=True)
            form.add_error(None, f"An unexpected error occurred while saving the connection: {e}")
            return self.form_invalid(form)

        # 4. 儲存後動作 (未來擴充點)
        # ==================================
        # 這裡就是您未來加入 tasks.py 後，觸發非同步任務的地方。
        # 現在先註解掉，您的程式碼依然可以正常運作。
        # if source_name == "FACEBOOK_ADS":
        #     from .tasks import fetch_facebook_data_task
        sync_connection_data_task.delay(self.object.pk) 
        #     messages.info(self.request, "A background task to fetch data has been scheduled.")

        # 5. 清理與重導向
        # ==================================
        # 清理用來引導流程的 session 資料
        self.request.session.pop("selected_client_id", None)
        self.request.session.pop("selected_dataset_id", None)

        # 重導向到成功頁面
        return redirect(self.get_success_url())

    def get_success_url(self):
        return reverse("connections:connection_detail", kwargs={"pk": self.object.pk})


class ConnectionDetailView(LoginRequiredMixin, DetailView):
    model = Connection
    template_name = "connections/connection_detail.html"
    context_object_name = "connection"

    def get_queryset(self):
        return Connection.objects.filter(user=self.request.user)

    def get_facebook_context_data(self, connection):
        """Get Facebook Ads specific context data"""
        return {
            "facebook_ad_account_id": connection.config.get('facebook_ad_account_id') if connection.config else None,
            "selected_fields": connection.config.get('selected_fields', []) if connection.config else [],
            "dimensions": connection.config.get('dimensions', []) if connection.config else [],
            "action_dimensions": connection.config.get('action_dimensions', []) if connection.config else [],
            "metrics": connection.config.get('metrics', []) if connection.config else [],
            "date_range_type": connection.config.get('date_range_type', 'preset') if connection.config else 'preset',
            "date_preset": connection.config.get('date_preset') if connection.config else None,
            "date_since": connection.config.get('date_since') if connection.config else None,
            "date_until": connection.config.get('date_until') if connection.config else None,
        }

    def get_google_ads_context_data(self, connection):
        """Get Google Ads specific context data"""
        return {
            "customer_id": connection.config.get('customer_id') if connection.config else None,
            "report_format": connection.config.get('report_format', 'standard') if connection.config else 'standard',
        }

    def get_google_ad_manager_context_data(self, connection):
        """Get Google Ad Manager specific context data"""
        return {
            "network_code": connection.config.get('network_code') if connection.config else None,
        }

    def get_youtube_context_data(self, connection):
        """Get YouTube Channel specific context data"""
        return {
            "channel_id": connection.config.get('channel_id') if connection.config else None,
        }

    def get_google_play_context_data(self, connection):
        """Get Google Play specific context data"""
        return {
            "gcs_bucket": connection.config.get('gcs_bucket') if connection.config else None,
        }

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        connection = self.get_object()
        
        # Common OAuth status details (primarily for Google in current _base.html)
        # For Facebook, the _base.html checks client.facebook_social_account directly
        if connection.social_account: # This might be Google or Facebook social account
            provider = connection.social_account.provider
            context["oauth_provider_name"] = provider.title()
            context["oauth_account_name"] = connection.social_account.extra_data.get("name", connection.social_account.extra_data.get("email", "N/A"))

            try:
                # Attempt to get token details, handling cases where it might not exist or be specific
                social_token = SocialToken.objects.filter(
                    account=connection.social_account, 
                    # app__provider=provider # Use provider from social_account
                ).first()

                if social_token:
                    context["oauth_status_detail"] = "active" # Generic status
                    if hasattr(social_token, 'expires_at') and social_token.expires_at:
                        context["oauth_expires"] = social_token.expires_at
                        if social_token.expires_at < timezone.now():
                            context["oauth_status_message"] = f"Token for {provider.title()} may be expired. Consider re-authorizing."
                            context["oauth_status_detail"] = "expired" 
                    else:
                        context["oauth_status_message"] = f"Token details for {provider.title()} loaded."
                else:
                    context["oauth_status_detail"] = "linked_no_token"
                    context["oauth_status_message"] = f"Account {provider.title()} is linked, but token details are missing."
            except SocialToken.DoesNotExist:
                context["oauth_status_detail"] = "error_fetching_token"
                context["oauth_status_message"] = f"Error fetching token details for {provider.title()}."
        else: # No social account linked to the connection directly
            if connection.data_source.name == "FACEBOOK_ADS" and connection.client and connection.client.facebook_social_account:
                 # FB connection relies on Client's social account
                context["oauth_provider_name"] = "Facebook"
                context["oauth_account_name"] = connection.client.facebook_social_account.extra_data.get("name", "N/A")
                # Further FB token status can be added if needed here
            else:
                context["oauth_status_detail"] = "not_linked"
                context["oauth_status_message"] = "No social account directly linked to this connection."


        if connection.data_source.name == "FACEBOOK_ADS":
            fb_config = connection.config or {}
            context["facebook_config"] = fb_config # Pass full config for easier access in template
            context["selected_facebook_ad_account_id"] = fb_config.get("facebook_ad_account_id")
            context["selected_fields"] = fb_config.get("selected_fields", []) # Example
        
        elif connection.data_source.name == "GOOGLE_ADS":
            context["gcp_project_id"] = settings.GOOGLE_CLOUD_PROJECT_ID
            # Add other Google Ads specific context if needed

        # Add data source specific context
        if connection.data_source.name == "FACEBOOK_ADS":
            context.update(self.get_facebook_context_data(connection))
        elif connection.data_source.name == "GOOGLE_ADS":
            context.update(self.get_google_ads_context_data(connection))
        elif connection.data_source.name == "GOOGLE_AD_MANAGER":
            context.update(self.get_google_ad_manager_context_data(connection))
        elif connection.data_source.name == "YOUTUBE_CHANNEL":
            context.update(self.get_youtube_context_data(connection))
        elif connection.data_source.name == "GOOGLE_PLAY":
            context.update(self.get_google_play_context_data(connection))

        # Add common context
        context.update({
            "connection": connection,
            "data_source": connection.data_source,
            "client": connection.client,
            "gcp_project_id": settings.GOOGLE_CLOUD_PROJECT_ID,
            "dataset_id": connection.target_dataset_id,
            "sync_frequency": connection.config.get('sync_frequency', 'daily') if connection.config else 'daily',
            "weekly_day_of_week": connection.config.get('weekly_day_of_week', '1') if connection.config else '1',
            "monthly_day_of_month": connection.config.get('monthly_day_of_month', '1') if connection.config else '1',
            "report_format": connection.config.get('report_format', 'standard') if connection.config else 'standard',
        })

        return context


class ConnectionUpdateView(LoginRequiredMixin, UpdateView):
    model = Connection
    context_object_name = 'connection'
    template_name = "connections/connection_form.html" # Reuses the create form template

    def get_queryset(self):
        return Connection.objects.filter(user=self.request.user)
    
    def get_form_class(self):
        connection = self.get_object()
        source_name = connection.data_source.name
        
        if source_name == 'GOOGLE_ADS':
            return GoogleAdsForm
        elif source_name == 'FACEBOOK_ADS':
            return FacebookAdsForm
        else:
            return BaseConnectionForm
        
    def get_initial(self):
        initial = super().get_initial()
        connection = self.get_object()
        config = connection.config or {} # 確保 config 是個字典，避免錯誤

        # 根據我們在 forms.py 中定義的欄位，填入初始值
        initial['display_name'] = connection.display_name
        initial['target_dataset_id'] = self.request.session.get('selected_dataset_id')
        
        # 通用設定
        initial['sync_frequency'] = config.get('sync_frequency')
        initial['weekly_day_of_week'] = config.get('weekly_day_of_week')
        initial['monthly_day_of_month'] = config.get('monthly_day_of_month')

        # 特定資料來源的設定
        if connection.data_source.name == 'GOOGLE_ADS':
            initial['customer_id'] = config.get('customer_id')
            initial['report_format'] = config.get('report_format')
        elif connection.data_source.name == 'FACEBOOK_ADS':
            initial['facebook_ad_account_id'] = config.get('facebook_ad_account_id')
            initial['selected_fields'] = config.get('selected_fields', [])
            # ... 您可以繼續加入 date_range_type 等其他欄位的初始值

        return initial

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        connection = self.get_object()
        
        # 將必要的物件傳遞給 Form 的 __init__ 方法
        kwargs['user'] = self.request.user
        kwargs['request'] = self.request
        kwargs['data_source_instance'] = connection.data_source

        # 如果是 Facebook，我們需要準備 ad_accounts 的選項並傳給 form
        if connection.data_source.name == 'FACEBOOK_ADS':
            ad_accounts = []
            client = connection.client
            if client and client.facebook_social_account:
                try:
                    token_obj = SocialToken.objects.get(account=client.facebook_social_account, app__provider='facebook')
                    fb_client = FacebookAdsAPIClient(
                        app_id=settings.FACEBOOK_APP_ID,
                        app_secret=settings.FACEBOOK_APP_SECRET,
                        access_token=token_obj.token
                    )
                    ad_accounts = fb_client.get_ad_accounts()
                except (SocialToken.DoesNotExist, Exception) as e:
                    logger.error(f"Failed to get FB Ad Accounts for update form: {e}")
                    messages.warning(self.request, "Could not retrieve latest Facebook Ad Accounts list.")
            
            # 將 ad_accounts 轉換為 (value, label) 格式並傳遞
            kwargs['facebook_ad_accounts_choices'] = [(acc['id'], f"{acc['name']} ({acc['id']})") for acc in ad_accounts]
            
        return kwargs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        connection = self.get_object()
        context['data_source'] = connection.data_source
        context['client'] = connection.client
        
        # 如果是 Facebook，我們需要將欄位列表傳給範本用於渲染
        if connection.data_source.name == "FACEBOOK_ADS":
            facebook_page_context = get_facebook_ads_page_context()
            context.update(facebook_page_context)

        return context

    def form_valid(self, form):
        messages.success(self.request, f"Connection '{form.instance.display_name}' updated successfully!")
        # 呼叫我們在 forms.py 中定義的、聰明的 save() 方法
        self.object = form.save()
        return redirect(self.get_success_url())

    def get_success_url(self):
        return reverse("connections:connection_detail", kwargs={"pk": self.object.pk})

class ConnectionDeleteView(LoginRequiredMixin, DeleteView):
    model = Connection
    template_name = "connections/connection_confirm_delete.html"
    success_url = reverse_lazy("connections:connection_list")

    def get_queryset(self):
        return Connection.objects.filter(user=self.request.user)

    def delete(self, request, *args, **kwargs):
        # ... (existing DTS deletion logic for Google)
        connection_instance = self.get_object()
        dts_config_name = getattr(connection_instance, 'dts_transfer_config_name', None) # Make it safer

        response = super().delete(request, *args, **kwargs) 

        if dts_config_name: # This is Google DTS specific
            try:
                credentials_adc, project_adc = default(
                    scopes=["https://www.googleapis.com/auth/bigquery"]
                )
                dts_service = build(
                    "bigquerydatatransfer", "v1", credentials=credentials_adc
                )
                dts_service.projects().locations().transferConfigs().delete(
                    name=dts_config_name
                ).execute()
                logger.info(f"Successfully deleted DTS config: {dts_config_name}")
                messages.success(
                    request,
                    f'Connection and associated data transfer ({dts_config_name.split("/")[-1]}) deleted successfully.',
                )
            except Exception as e:
                logger.error(f"Error deleting DTS config {dts_config_name}: {str(e)}")
                messages.warning(
                    request,
                    f'Connection deleted, but failed to delete associated data transfer ({dts_config_name.split("/")[-1]}). Please check Google Cloud Console. Error: {str(e)}',
                )
        else:
            # If not a Google DTS connection, or no DTS config name was stored
            messages.success(request, "Connection deleted successfully.")
        return response




@login_required
def connection_oauth_authorize_view(request, pk):
    return api_oauth_authorize(request, pk) # From google_oauth.py

@login_required
def reauthorize_connection(request, pk):
    connection = get_object_or_404(Connection, pk=pk, user=request.user)
    request.session["oauth_connection_pk_to_link"] = pk # Used to link social account after re-auth
    
    provider_name = None
    if connection.data_source.name == "GOOGLE_ADS": # Or other Google services
        provider_name = "google"
    elif connection.data_source.name == "FACEBOOK_ADS":
        provider_name = "facebook"
        # For Facebook, re-auth might mean re-doing the client-level auth
        # as the token is tied to the client's SocialAccount
        messages.info(request, "To re-authorize Facebook, please go to the client's authorization page or re-initiate the OAuth flow for the client.")
        # Redirect to a page where they can trigger client_oauth_authorize for Facebook
        # Or, if you want to directly trigger it:
        # return redirect(reverse('connections:client_oauth_authorize', args=[connection.client.id]) + '?data_source=FACEBOOK_ADS')
        # For now, let's assume client re-auth is handled elsewhere or they re-auth the client.
        # This reauthorize_connection is more aligned with allauth's "connect" process.
        # For Facebook, it might be better to guide them to re-auth the Client.
        # However, if the goal is to re-link the connection's `social_account` field (if it's used for FB directly)
        # then a similar flow to Google might be attempted.
        # Given current setup, FB token is via Client.
        # Let's make this re-authorize specific to the data source type.
        messages.warning(request, "Re-authorization for Facebook connections typically involves re-authorizing the client's Facebook link. If issues persist, try re-authorizing the client.")
        return redirect("connections:connection_detail", pk=pk)


    if provider_name:
        messages.info(
            request, f"Please re-authorize your {provider_name.title()} account for this connection."
        )
        # The 'next' URL should ideally bring them back to the connection detail or form
        # Ensure the redirect URL after allauth is handled correctly
        # It might go to `oauth_callback` or a custom allauth callback if defined
        
        # Store where to redirect *after* allauth completes and our oauth_callback is hit
        request.session['oauth_redirect_url'] = reverse('connections:connection_detail', args=[pk])

        return redirect(
            f"{reverse('account_login')}?process=connect&provider={provider_name}" 
            # `next` param for allauth's internal redirect after its own process,
            # not to be confused with our `oauth_redirect_url` for after our callback.
            # Allauth's `next` usually points to where it should go if login/connect is successful
            # before our own specific logic in `oauth_callback` or `facebook_oauth_callback` runs.
            # Often, allauth's own views handle the SocialAccount creation/update, then redirect.
        )
    else:
        messages.error(request, "Re-authorization not configured for this data source type.")
        return redirect("connections:connection_detail", pk=pk)

@login_required
def check_auth_status(request):
    """檢查使用者的 Google 授權狀態"""
    try:
        client_id = request.GET.get('client_id')
        if not client_id:
            return JsonResponse({"is_authorized": False, "email": "", "error": "No client_id provided"})

        client = get_object_or_404(Client, id=client_id)
        
        # 檢查 client 是否有 google_social_account
        if not client.google_social_account:
            return JsonResponse({"is_authorized": False, "email": ""})

        social_account = client.google_social_account
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
    except Exception as e:
        logger.error(f"Error checking auth status: {str(e)}")
        return JsonResponse({"is_authorized": False, "email": "", "error": str(e)})

@login_required
def client_oauth_authorize(request, client_id): # client_id is UUID here
   
    data_source_name = request.GET.get('data_source')
    client = get_object_or_404(Client, id=client_id)

    request.session['oauth_client_id_to_link'] = str(client.id)
    request.session['final_redirect_after_oauth_link'] = request.META.get('HTTP_REFERER', reverse('connections:connection_list'))

    if data_source_name == "GOOGLE_ADS":
        # 直接使用 allauth 的 Google 登入 URL
        google_login_url = reverse('google_login')
        
        # 構建參數
        params = {
            'process': 'connect',  # 用於連接現有帳戶
            'next': reverse('connections:oauth_callback')  # OAuth 完成後的回調
        }
        
        # 構建最終 URL
        final_url = f"{google_login_url}?{urllib.parse.urlencode(params)}"
        return redirect(final_url)

    elif data_source_name == "FACEBOOK_ADS":
        auth_url, _ = get_facebook_oauth_url(request, str(client_id))
        return redirect(auth_url)
        
    else:
        messages.error(request, "Invalid data source for OAuth.")
        return redirect("connections:connection_list")

@login_required
def oauth_callback(request): # Primarily for Google via AllAuth
    """Handle OAuth callback and link social account to client"""
    logger.info(f"OAuth callback called with GET params: {request.GET}")
    logger.info(f"Session data: oauth_client_id_to_link={request.session.get('oauth_client_id_to_link')}")
    
    client_id = request.session.pop('oauth_client_id_to_link', None)
    if not client_id:
        logger.error("No client_id found in session")
        messages.error(request, "OAuth session expired or invalid. Please try again.")
        return redirect("connections:connection_list")

    try:
        # 獲取最新的 Google social account
        social_accounts = SocialAccount.objects.filter(
            user=request.user, 
            provider="google"
        ).order_by('-date_joined')
        
        logger.info(f"Found {social_accounts.count()} Google social accounts")
        
        if not social_accounts.exists():
            logger.error("No Google social account found for user")
            messages.error(request, "Please complete the Google authorization process first.")
            return redirect("connections:connection_list")
            
        social_account = social_accounts.first()
        logger.info(f"Using Google social account: {social_account.extra_data.get('email', 'No email found')}")
            
        client = Client.objects.get(id=client_id)
        logger.info(f"Found client: {client.name}")
        
        # 檢查是否已經有 Google social account
        if client.google_social_account:
            logger.info(f"Client already has Google account: {client.google_social_account.extra_data.get('email')}")
            messages.info(request, f"Client already has Google account: {client.google_social_account.extra_data.get('email')}")
        else:
            client.google_social_account = social_account
            client.save(update_fields=['google_social_account'])
            logger.info(f"Successfully linked Google account to client {client.name}")
            messages.success(
                request, 
                f"Google account '{social_account.extra_data.get('email')}' successfully linked to client '{client.name}'."
            )

    except Client.DoesNotExist:
        logger.error(f"Client with ID {client_id} not found during OAuth callback")
        messages.error(request, "Client not found. Please try again.")
    except Exception as e:
        logger.error(f"Unexpected error during OAuth callback: {e}")
        messages.error(request, "An error occurred while linking the account. Please try again.")
    
    # 重導向邏輯
    redirect_url = request.session.pop('final_redirect_after_oauth_link', None)
    if not redirect_url:
        # 如果沒有儲存的重導向 URL，嘗試回到連接建立頁面
        base_url = reverse('connections:connection_create', kwargs={
            'source_name': 'GOOGLE_ADS',
            'client_id': client_id
        })
        dataset_id = request.session.get('selected_dataset_id')
        if dataset_id:
            redirect_url = f"{base_url}?dataset_id={dataset_id}"
        else:
            redirect_url = base_url
    
    logger.info(f"Redirecting to: {redirect_url}")
    return redirect(redirect_url)

class GoogleOAuth2CustomCallbackView(OAuth2CallbackView, View):
    adapter_class = GoogleOAuth2Adapter

    def dispatch(self, request, *args, **kwargs):
        # If AllAuth's standard callback view is working, this custom one might not be hit
        # or might interfere. Ensure it's correctly configured in urls.py if used.
        response = super().dispatch(request, *args, **kwargs)
        if hasattr(response, "url"): # Check if it's a redirect response
            # This logic seems to force render a template instead of redirecting.
            # This can be useful to close a popup window and signal parent.
            # Ensure 'account/socialaccount_callback.html' exists and handles this.
            return render(request, "account/socialaccount_callback.html") 
        return response

@login_required
def save_oauth_redirect(request): # Used by _base.html JS
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            redirect_url = data.get('redirect_url')
            if redirect_url:
                # This session key 'oauth_redirect_url' is generic.
                # Be careful if Google and Facebook flows use it differently.
                # Facebook callback seems to construct its own redirect.
                # Google callback uses 'final_redirect_after_oauth_link'.
                request.session['oauth_redirect_url_generic_save'] = redirect_url # Use a more specific name
                
                client_id = data.get('client_id') # Passed from JS
                dataset_id = data.get('dataset_id') # Passed from JS
                if client_id:
                    request.session['selected_client_id_from_js_save'] = client_id
                if dataset_id:
                    request.session['selected_dataset_id_from_js_save'] = dataset_id
                return JsonResponse({'status': 'success'})
        except json.JSONDecodeError:
            pass # Fall through to error
    return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)

@login_required
@require_http_methods(["GET"])
def facebook_oauth_callback(request):
    code = request.GET.get('code')
    state_param = request.GET.get('state') # This should be the client_id we passed
    
    # Retrieve client_id from state or session (state is more reliable for CSRF protection)
    client_id_from_state = state_param
    client_id_from_session = request.session.pop("facebook_client_id_to_link", None)

    if not client_id_from_state and not client_id_from_session: # Prefer state
        messages.error(request, "No client ID found in state or session for Facebook OAuth.")
        return redirect("connections:connection_list")
    
    client_id = client_id_from_state or client_id_from_session

    if not code:
        error_reason = request.GET.get('error_reason')
        error_description = request.GET.get('error_description')
        logger.error(f"Facebook OAuth error: No code. Reason: {error_reason}, Desc: {error_description}")
        messages.error(request, f"Facebook authorization failed. Reason: {error_description or error_reason or 'Unknown error'}")
        return redirect("connections:connection_list")
    
    try:
        # Exchange code for an access token
        redirect_uri = request.build_absolute_uri(reverse('connections:facebook_oauth_callback'))
        redirect_uri = redirect_uri.replace('http://', 'https://') # Ensure HTTPS
        
        token_url = (
            f"https://graph.facebook.com/v18.0/oauth/access_token"
            f"?client_id={settings.FACEBOOK_APP_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&client_secret={settings.FACEBOOK_APP_SECRET}"
            f"&code={code}"
        )
        
        api_response = requests.get(token_url)
        api_response.raise_for_status()
        token_data = api_response.json()
        
        access_token = token_data.get('access_token')
        if not access_token:
            logger.error(f"Facebook OAuth: No access_token in response data: {token_data}")
            raise Exception("Access token not found in Facebook's response.")
        
        # Get user info from Facebook using the new access token
        graph = facebook.GraphAPI(access_token=access_token)
        user_info = graph.get_object('me', fields='id,name,email')
        
        try:
            current_facebook_app = SocialApp.objects.get(
                provider='facebook',
                client_id=settings.FACEBOOK_APP_ID
            )
        except SocialApp.DoesNotExist:
            logger.error(f"CRITICAL: Facebook SocialApp with provider 'facebook' and client_id '{settings.FACEBOOK_APP_ID}' not found in Django Admin.")
            messages.error(request, "Facebook application is not configured correctly in the system.")
            return redirect("connections:connection_list")
        except SocialApp.MultipleObjectsReturned:
            logger.error(f"CRITICAL: Multiple Facebook SocialApp configurations found.")
            messages.error(request, "Ambiguous Facebook application configuration.")
            return redirect("connections:connection_list")

        # Create or update SocialAccount
        social_account, created = SocialAccount.objects.update_or_create(
            user=request.user,
            provider=current_facebook_app.provider,
            uid=user_info['id'],
            defaults={'extra_data': user_info}
        )

        # Create or update SocialToken
        SocialToken.objects.update_or_create(
            account=social_account,
            app=current_facebook_app,
            defaults={'token': access_token}
        )

        client = Client.objects.get(id=client_id)
        client.facebook_social_account = social_account
        client.save(update_fields=['facebook_social_account'])

        messages.success(request, f"Facebook account '{user_info.get('name', user_info['id'])}' successfully authorized and linked to client {client.name}.")
        
        # Get the base URL for connection create
        base_url = reverse('connections:connection_create', kwargs={
            'source_name': 'FACEBOOK_ADS',
            'client_id': client_id
        })
        
        # Get dataset_id from session
        dataset_id = request.session.get('selected_dataset_id')
        
        # Construct the final redirect URL
        if dataset_id:
            final_url = f"{base_url}?dataset_id={dataset_id}"
        else:
            final_url = base_url
            
        return redirect(final_url)

    except requests.exceptions.HTTPError as e:
        logger.error(f"Facebook OAuth HTTPError during token exchange: {e.response.text}", exc_info=True)
        messages.error(request, f"Failed to get access token from Facebook: {e.response.json().get('error',{}).get('message','Server error')}")
    except Client.DoesNotExist:
        messages.error(request, "Client not found for Facebook OAuth linking.")
    except SocialAccount.DoesNotExist:
        messages.error(request, "Failed to create or link Facebook social account.")
    except Exception as e:
        logger.error(f"Facebook OAuth callback unexpected error: {str(e)}", exc_info=True)
        messages.error(request, f"An unexpected error occurred during Facebook authorization: {str(e)}")
    
    return redirect("connections:connection_list")


