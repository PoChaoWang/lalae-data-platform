# backend/apps/connections/serializers.py

from rest_framework import serializers
from django.conf import settings
import logging

from .models import Connection, DataSource, ConnectionExecution
from apps.clients.models import Client
from allauth.socialaccount.models import SocialToken, SocialAccount
from django.utils import timezone
from django.contrib.auth import get_user_model

from .apis.google_sheet import GoogleSheetAPIClient
from .apis.facebook_ads import FacebookAdsAPIClient
from .apis.google_oauth import _refresh_user_social_token
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from apps.clients.models import Client as ClientModel

logger = logging.getLogger(__name__)

class DataSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSource
        fields = ['id', 'name', 'display_name']

class SimpleSocialAccountSerializer(serializers.ModelSerializer):
    # 從 extra_data 中取出 name 和 email
    name = serializers.CharField(source='extra_data.name', read_only=True, default='')
    email = serializers.CharField(source='extra_data.email', read_only=True, default='')

    class Meta:
        model = SocialAccount
        fields = ['id', 'provider', 'uid', 'name', 'email']

class ClientSerializer(serializers.ModelSerializer):
    facebook_social_account = SimpleSocialAccountSerializer(read_only=True)
    google_social_account = SimpleSocialAccountSerializer(read_only=True)

    class Meta:
        model = Client
        fields = [
            'id', 
            'name', 
            'created_at', 
            'bigquery_dataset_id',
            'facebook_social_account', 
            'google_social_account'
        ]

class ConnectionListSerializer(serializers.ModelSerializer):
    data_source = serializers.CharField(source='data_source.display_name', read_only=True)
    client = serializers.CharField(source='client.name', read_only=True)
    class Meta:
        model = Connection
        fields = [
            'id', 
            'is_enabled', 
            'display_name', 
            'data_source', 
            'client',      
            'status', 
            'target_dataset_id', 
            'updated_at',
        ]


class ConnectionSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    data_source = DataSourceSerializer(read_only=True)
    
    client_id = serializers.UUIDField(write_only=True, required=True)
    data_source_id = serializers.IntegerField(write_only=True, required=True)

    last_execution_status = serializers.SerializerMethodField()
    last_execution_time = serializers.SerializerMethodField()
    
    # 讓 user 欄位在讀取時可見，但在建立時是唯讀的 (由 perform_create 設定)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Connection
        fields = [
            'id',
            'display_name',
            'target_dataset_id', 
            'client',
            'client_id',
            'data_source',
            'data_source_id',
            'status',
            'is_enabled',
            'config',
            'created_at',
            'updated_at',
            'user',
            'last_execution_status',
            'last_execution_time',
        ]
        read_only_fields = ['status', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """
        覆寫 create 方法，以處理 client_id 和 data_source_id，
        並在建立 Connection 時關聯 SocialAccount。
        """
        client_id = validated_data.pop('client_id')
        data_source_id = validated_data.pop('data_source_id')
        
        try:
            client = ClientModel.objects.get(id=client_id)
            data_source = DataSource.objects.get(id=data_source_id)
        except (ClientModel.DoesNotExist, DataSource.DoesNotExist) as e:
            raise serializers.ValidationError(str(e))

        # ✨ 解決問題的核心邏輯 ✨
        connection = Connection.objects.create(
            client=client,
            data_source=data_source,
            **validated_data
        )

        # 根據資料源，將 Client 上的 social_account 賦值給 Connection
        if data_source.name == 'GOOGLE_ADS':
            if not client.google_social_account:
                # 在此處做一個防禦性檢查
                raise serializers.ValidationError("The selected client is not authorized with a Google account.")
            connection.social_account = client.google_social_account
        elif data_source.name == 'FACEBOOK_ADS':
            if not client.facebook_social_account:
                raise serializers.ValidationError("The selected client is not authorized with a Facebook account.")
            connection.social_account = client.facebook_social_account
        
        connection.save() # 儲存 social_account 的關聯
        
        return connection

    def get_last_execution_status(self, obj):
        last_execution = obj.executions.order_by('-started_at').first()
        return last_execution.status if last_execution else None

    def get_last_execution_time(self, obj):
        last_execution = obj.executions.order_by('-started_at').first()
        return last_execution.started_at if last_execution else None

    def validate(self, data):
        is_creating = self.instance is None

        if is_creating:
            client_id = data.get('client_id')
            data_source_id = data.get('data_source_id')

            logger.info(f"====== Starting validation for NEW connection ======")
            logger.info(f"Received client_id from frontend: {client_id}")
            logger.info(f"Received data_source_id from frontend: {data_source_id}")

            if not client_id or not data_source_id:
                raise serializers.ValidationError("client_id and data_source_id are required for creating a new connection.")

            try:
                client = Client.objects.get(id=client_id)
                data_source = DataSource.objects.get(id=data_source_id)

                logger.info(f"Successfully fetched Client from DB: '{client.name}' (ID: {client.id})")
                logger.info(f"Client's linked Google Social Account in DB: {client.google_social_account}")


            except (Client.DoesNotExist, DataSource.DoesNotExist) as e:

                logger.error(f"Could not find Client or DataSource in DB. Error: {e}")

                raise serializers.ValidationError(str(e))
        else: 
            client = self.instance.client
            data_source = self.instance.data_source

        should_run_api_test = is_creating or 'config' in data

        if not should_run_api_test:
            return data

        config = data.get('config', self.instance.config if self.instance else {})
        logger.info(f"Running validation for source: {data_source.name}")

        try:
            if data_source.name == "GOOGLE_SHEET":
                sheet_id = config.get('sheet_id')
                if not sheet_id:
                    raise serializers.ValidationError({"config.sheet_id": "Sheet ID is required."})
                
                api_client = GoogleSheetAPIClient()
                if not api_client.check_sheet_permissions(sheet_id):
                    raise serializers.ValidationError({"config.sheet_id": "Permission Denied. Please ensure our service account has 'Editor' access to this Google Sheet."})
                logger.info("Google Sheet permission check PASSED.")

            elif data_source.name == "FACEBOOK_ADS":
                if not client.facebook_social_account:
                    raise serializers.ValidationError("This client does not have a linked Facebook account.")
                
                token_obj = SocialToken.objects.get(account=client.facebook_social_account, app__provider='facebook')
                fb_client = FacebookAdsAPIClient(
                    app_id=settings.FACEBOOK_APP_ID,
                    app_secret=settings.FACEBOOK_APP_SECRET,
                    access_token=token_obj.token,
                    ad_account_id=config.get('facebook_ad_account_id')
                )
                # 執行輕量 API 請求作為測試
                fb_client.get_insights(fields=['campaign_name'], date_preset='yesterday')
                logger.info("Facebook API connection test PASSED.")

            elif data_source.name == "GOOGLE_ADS":
                logger.info(f"Re-fetching client '{client.name}' to ensure data is fresh before API validation.")
                client = Client.objects.get(id=client.id)
                logger.info(f"Fresh client object's Google Social Account is: {client.google_social_account}")

                if not client.google_social_account:
                    # 為了保險起見，我們仍然可以保留一個對 social_account 的直接檢查
                    raise serializers.ValidationError("The client object is not linked to any Google Social Account.")
                
                try:
                    social_token = SocialToken.objects.get(account=client.google_social_account)
                    logger.info("Found associated SocialToken successfully.")
                except SocialToken.DoesNotExist:
                    logger.error(f"VALIDATION FAILED for client '{client.name}': SocialAccount is linked, but SocialToken is missing!")
                    raise serializers.ValidationError("Authorization token not found for the linked Google account. Please re-authorize.")
        
                _refresh_user_social_token(social_token)

                if social_token.expires_at and social_token.expires_at < timezone.now():
                    logger.warning(f"Token for user {social_token.account.user.id} has expired. Attempting to refresh.")
                    try:
                        _refresh_user_social_token(social_token)
                    except Exception as e:
                        logger.error(f"The _refresh_user_social_token function failed: {e}", exc_info=True)
                        raise serializers.ValidationError("Failed to refresh the expired Google authorization. Please re-authorize manually.")
                
                google_ads_config = {
                    "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
                    "client_id": social_token.app.client_id,
                    "client_secret": social_token.app.secret,
                    "refresh_token": social_token.token_secret,
                    "login_customer_id": config.get("customer_id"),
                    "use_proto_plus": True
                }
                google_ads_client = GoogleAdsClient.load_from_dict(google_ads_config)
                customer_service = google_ads_client.get_service("CustomerService")
                customer_service.list_accessible_customers()
                logger.info("Google Ads API connection test PASSED.")

        except (SocialToken.DoesNotExist, GoogleAdsException) as e:
            logger.error(f"API validation failed for {data_source.name}: {e}", exc_info=True)
            raise serializers.ValidationError(f"API Connection Test Failed for {data_source.name}. Please check credentials and permissions. Details: {e}")
        except serializers.ValidationError:
            raise
        except Exception as e:
            logger.error(f"Unexpected API validation error for {data_source.name}: {e}", exc_info=True)
            raise serializers.ValidationError(f"An unexpected error occurred during API validation: {e}")

        return data

class TriggeredBySerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email']

class ConnectionExecutionSerializer(serializers.ModelSerializer):
    triggered_by = TriggeredBySerializer(read_only=True)
    config = serializers.JSONField(source='config_snapshot', read_only=True)

    class Meta:
        model = ConnectionExecution
        fields = [
            'id', 'started_at', 'finished_at', 'status',
            'message', 'config', 'triggered_by'
        ]
