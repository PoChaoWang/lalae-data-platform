# backend/apps/connections/serializers.py

from rest_framework import serializers
from django.conf import settings
import logging

from .models import Connection, DataSource, ConnectionExecution
from apps.clients.models import Client, ClientSocialAccount
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
    class Meta:
        model = Client
        fields = [
            'id', 
            'name', 
            'created_at', 
            'bigquery_dataset_id',
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
    
    # 新增 social_account_id 字段，用於接收前端傳來的 SocialAccount UUID
    social_account_id = serializers.IntegerField(write_only=True, required=False, allow_null=True) 

    last_execution_status = serializers.SerializerMethodField()
    last_execution_time = serializers.SerializerMethodField()
    
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
            'social_account_id', # 加入到 fields 列表中
        ]
        read_only_fields = ['status', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """
        覆寫 create 方法，以處理 client_id, data_source_id 和 social_account_id。
        """
        client_id = validated_data.pop('client_id')
        data_source_id = validated_data.pop('data_source_id')
        social_account_id = validated_data.pop('social_account_id', None) # 獲取 social_account_id

        try:
            client = Client.objects.get(id=client_id)
            data_source = DataSource.objects.get(id=data_source_id)
        except (Client.DoesNotExist, DataSource.DoesNotExist) as e:
            raise serializers.ValidationError(str(e))

        social_account_instance = None
        
        if social_account_id:
            try:
                social_account_instance = SocialAccount.objects.get(id=social_account_id) 
                
                # 額外檢查：確認該 SocialAccount 確實已連結到 Client
                if not ClientSocialAccount.objects.filter(client=client, social_account=social_account_instance).exists():
                    raise serializers.ValidationError({"social_account_id": "Selected social account is not linked to this client."})

            except SocialAccount.DoesNotExist:
                raise serializers.ValidationError({"social_account_id": "Selected social account not found or not owned by you."})
            except ClientSocialAccount.DoesNotExist: # 雖然上面已經檢查過了，但這裡再次檢查以防萬一
                raise serializers.ValidationError({"social_account_id": "Selected social account is not linked to this client."})

        # 建立 Connection 物件
        connection = Connection.objects.create(
            client=client,
            data_source=data_source,
            social_account=social_account_instance, # 將 social_account 賦值給 Connection
            **validated_data
        )
        
        return connection

    def get_last_execution_status(self, obj):
        last_execution = obj.executions.order_by('-started_at').first()
        return last_execution.status if last_execution else None

    def get_last_execution_time(self, obj):
        last_execution = obj.executions.order_by('-started_at').first()
        return last_execution.started_at if last_execution else None

    def validate(self, data):
        # 這裡的 self.instance 在 update 時會有值，在 create 時為 None
        is_creating = self.instance is None
        
        # 如果是更新且沒有提供 client_id 和 data_source_id，則從現有 instance 獲取
        client = data.get('client_id')
        data_source = data.get('data_source_id')
        social_account_id = data.get('social_account_id', None) 

        if is_creating:
            if not client or not data_source:
                raise serializers.ValidationError("client_id and data_source_id are required for creating a new connection.")
            try:
                client_obj = Client.objects.get(id=client)
                data_source_obj = DataSource.objects.get(id=data_source)
            except (Client.DoesNotExist, DataSource.DoesNotExist) as e:
                raise serializers.ValidationError(str(e))
        else:
            client_obj = self.instance.client
            data_source_obj = self.instance.data_source
            # 如果是更新，且 social_account_id 沒有提供，使用 Connection 自身已有的 social_account
            if social_account_id is None and self.instance.social_account:
                 social_account_id = self.instance.social_account.id # 使用已有的 social_account_id

        logger.info(f"[Serializers] Validating for client_id: {client_obj.id}, data_source_id: {data_source_obj.id}, social_account_id: {social_account_id}")
        logger.info(f"[Serializers] Request user ID: {self.context['request'].user.id}")
            
        should_run_api_test = is_creating or 'config' in data or 'social_account_id' in data

        if not should_run_api_test and not social_account_id: # 如果沒有要跑 API 測試，且沒有 social account 也就不檢查了
            return data

        config = data.get('config', self.instance.config if self.instance else {})
        
        # 獲取實際用於 API 測試的 SocialAccount 和 Token
        social_account_for_test = None
        social_token_for_test = None
        
        if social_account_id:
            try:
                client_social_link = ClientSocialAccount.objects.get(
                    client=client_obj,                             
                    social_account__pk=social_account_id,       
                )

                logger.info(f"[Serializers] ClientSocialAccount found: {client_social_link.pk}")
                social_account_for_test = client_social_link.social_account

                logger.info(f"[Serializers] social_account_for_test1: {social_account_for_test}")
                
                provider_name_from_data_source = data_source_obj.name.lower().split('_')[0]
                social_token_for_test = SocialToken.objects.get(
                    account=social_account_for_test, 
                    app__provider=provider_name_from_data_source
                )
                logger.info(f"[Serializers] social_token_for_test2: {social_token_for_test}")

            except ClientSocialAccount.DoesNotExist:
                logger.error(f"[Serializers] ClientSocialAccount.DoesNotExist for client: {client_obj.id}, social_account_id: {social_account_id}")
                raise serializers.ValidationError(
                    {"social_account_id": "Selected social account is not linked to this client, or is not owned by you, or provider is incorrect."}
                )
            except SocialToken.DoesNotExist:
                logger.error(f"[Serializers] SocialToken.DoesNotExist for social_account_id: {social_account_id}, provider: {provider_name_from_data_source}")
                # 針對 Facebook 的特定錯誤訊息
                if data_source_obj.name == "FACEBOOK_ADS":
                    raise serializers.ValidationError(
                        {"social_account_id": "Facebook authorization token not found for this account. Please re-authorize."}
                    )
                # 對於其他 OAuth 數據源
                elif data_source_obj.oauth_required:
                    raise serializers.ValidationError(
                        {"social_account_id": f"{data_source_obj.display_name} authorization token not found for this account. Please re-authorize."}
                    )
                # 如果不需要 OAuth 但沒有 token，則不拋錯
                else:
                    pass # 不需要 OAuth 的數據源，沒有 token 也是正常的
            except Exception as e:
                logger.error(f"[Serializers] General error in social account check: {e}", exc_info=True)
                raise serializers.ValidationError({"social_account_id": f"An error occurred with the selected social account: {e}"})


        # 對於需要 OAuth 的數據源，強制檢查 social_account_for_test
        if data_source_obj.oauth_required and not social_account_for_test:
            raise serializers.ValidationError({"social_account_id": "An authorized social account is required for this connection."})


        try:
            if data_source_obj.name == "GOOGLE_SHEET":
                sheet_id = config.get('sheet_id')
                if not sheet_id:
                    raise serializers.ValidationError({"config.sheet_id": "Sheet ID is required."})
                
                api_client = GoogleSheetAPIClient()
                if not api_client.check_sheet_permissions(sheet_id):
                    raise serializers.ValidationError({"config.sheet_id": "Permission Denied. Please ensure our service account has 'Editor' access to this Google Sheet."})
                logger.info("Google Sheet permission check PASSED.")

            elif data_source_obj.name == "FACEBOOK_ADS":
                if not social_token_for_test: # 再次檢查 token 是否存在
                    raise serializers.ValidationError("Facebook authorization token not found. Please re-authorize.")
                
                fb_client = FacebookAdsAPIClient(
                    app_id=settings.FACEBOOK_APP_ID,
                    app_secret=settings.FACEBOOK_APP_SECRET,
                    access_token=social_token_for_test.token, # 使用來自 social_token_for_test 的 token
                    ad_account_id=config.get('facebook_ad_account_id')
                )
                fb_client.get_insights(fields=['campaign_name'], date_preset='yesterday')
                logger.info("Facebook API connection test PASSED.")

            elif data_source_obj.name == "GOOGLE_ADS":
                if not social_token_for_test: # 再次檢查 token 是否存在
                    raise serializers.ValidationError("Google authorization token not found. Please re-authorize.")
                
                # 刷新 token (如果需要)
                if social_token_for_test.expires_at and social_token_for_test.expires_at < timezone.now():
                    logger.warning(f"Token for user {social_token_for_test.account.user.id} has expired. Attempting to refresh.")
                    try:
                        _refresh_user_social_token(social_token_for_test) # 使用新的 social_token_for_test
                    except Exception as e:
                        logger.error(f"The _refresh_user_social_token function failed: {e}", exc_info=True)
                        raise serializers.ValidationError("Failed to refresh the expired Google authorization. Please re-authorize manually.")
                
                google_ads_config = {
                    "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
                    "client_id": social_token_for_test.app.client_id,
                    "client_secret": social_token_for_test.app.secret,
                    "refresh_token": social_token_for_test.token_secret,
                    "login_customer_id": config.get("customer_id"),
                    "use_proto_plus": True
                }
                google_ads_client = GoogleAdsClient.load_from_dict(google_ads_config)
                customer_service = google_ads_client.get_service("CustomerService")
                customer_service.list_accessible_customers()
                logger.info("Google Ads API connection test PASSED.")

        except (SocialToken.DoesNotExist, GoogleAdsException) as e:
            logger.error(f"API validation failed for {data_source_obj.name}: {e}", exc_info=True)
            raise serializers.ValidationError(f"API Connection Test Failed for {data_source_obj.name}. Please check credentials and permissions. Details: {e}")
        except serializers.ValidationError:
            raise # 重新拋出已捕捉的驗證錯誤
        except Exception as e:
            logger.error(f"Unexpected API validation error for {data_source_obj.name}: {e}", exc_info=True)
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
