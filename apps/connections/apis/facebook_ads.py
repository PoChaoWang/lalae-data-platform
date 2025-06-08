# apps/connections/apis/facebook_ads.py
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.adsinsights import AdsInsights # Make sure AdsInsights is imported
from facebook_business.adobjects.user import User # Add this import
from facebook_business.exceptions import FacebookRequestError
import logging
import time
import datetime
from django.conf import settings
import os
import json
from django.urls import reverse

logger = logging.getLogger(__name__)

class FacebookAdsAPIClient:
    """
    用於與 Facebook Marketing API 互動的用戶端。
    """
    def __init__(self, app_id, app_secret, access_token, ad_account_id=None): # Added default None for ad_account_id
        """
        初始化 Facebook Ads API 用戶端。

        Args:
            app_id (str): 您的 Facebook 應用程式 ID。
            app_secret (str): 您的 Facebook 應用程式密鑰。
            access_token (str): 使用者的長期存取權杖。
            ad_account_id (str, optional): 要操作的廣告帳戶 ID (例如, 'act_xxxxxxxxxxx')。
                                          此參數對於僅載入欄位定義不是必需的。
        """
        self.app_id = app_id
        self.app_secret = app_secret
        self.access_token = access_token
        self.ad_account_id = ad_account_id

        if ad_account_id and isinstance(ad_account_id, str) and not ad_account_id.startswith('act_'):
            self.ad_account_id = f'act_{ad_account_id}'
            logger.info(f"Normalized ad_account_id from '{ad_account_id}' to '{self.ad_account_id}'")
        else:
            self.ad_account_id = ad_account_id

        self._api = None # To store the initialized API instance

        try:
            self._api = FacebookAdsApi.init( # Store the API instance
                app_id=self.app_id,
                app_secret=self.app_secret,
                access_token=self.access_token,
                crash_log=False
            )
            if self.ad_account_id:
                self.account = AdAccount(self.ad_account_id, api=self._api)
                logger.info(f"FacebookAdsApi instance initialized for account {self.ad_account_id}")
            else:
                self.account = None
                logger.info("FacebookAdsApi instance initialized without a specific ad account (ad_account_id was None or not provided). This is okay for loading field definitions or fetching ad accounts.")

        except FacebookRequestError as e:
            logger.error(f"Initializing FacebookAdsApi or AdAccount for {self.ad_account_id} failed: {e}")
            raise
        except Exception as e:
            logger.error(f"FacebookAdsApi initialization for {self.ad_account_id} encountered an unexpected error: {e}")
            raise

    def get_ad_accounts(self):
        """
        獲取與此用戶端憑證關聯的所有廣告帳戶。
        """
        if not self.access_token:
            logger.error("Access token is not available. Cannot fetch ad accounts.")
            return []
        try:
            # Ensure API is initialized if it wasn't (e.g. if client was created only for this)
            if not self._api:
                 self._api = FacebookAdsApi.get_default_api()
                 if not self._api: # if get_default_api() returns None because it wasn't init
                    FacebookAdsApi.init(
                        app_id=self.app_id,
                        app_secret=self.app_secret,
                        access_token=self.access_token,
                        crash_log=False
                    )
                    self._api = FacebookAdsApi.get_default_api()


            user = User(fbid='me', api=self._api)
            ad_accounts = user.get_ad_accounts(fields=[
                AdAccount.Field.account_id,
                AdAccount.Field.name,
                AdAccount.Field.account_status
            ])
            
            # Filter for active accounts, you might want to adjust this
            # Account status: 1 (ACTIVE), 2 (DISABLED), 3 (UNSETTLED), ...
            # See: https://developers.facebook.com/docs/marketing-api/reference/ad-account/
            active_accounts = [
                {'id': acc[AdAccount.Field.account_id], 'name': acc[AdAccount.Field.name]}
                for acc in ad_accounts if acc[AdAccount.Field.account_status] == 1
            ]
            logger.info(f"Fetched {len(active_accounts)} active ad accounts for the user.")
            return active_accounts
        except FacebookRequestError as e:
            logger.error(f"Facebook API request error while fetching ad accounts: {e}")
            if e.api_error_code() == 190: # Invalid or expired token
                logger.error("Access token invalid or expired. Re-authentication required.")
            # Potentially raise e or return empty list based on how you want to handle
        except Exception as e:
            logger.error(f"Unexpected error fetching ad accounts: {e}")
        return []

    def get_insights(self,
                    fields,
                    date_preset,
                    level=AdsInsights.Level.campaign,
                    time_increment=1,
                    breakdowns=None,
                    action_breakdowns=None,
                    extra_params=None):
        """
        獲取指定配置的廣告洞察報告 (修改為同步 GET 模式)。
        """
        if not self.account:
            logger.error("AdAccount is not initialized. Cannot get insights.")
            return []

        if not fields or not isinstance(fields, list):
            raise ValueError("The 'fields' argument must be a non-empty list of strings.")

        # --- 準備請求參數 ---
        params = {
            'level': level,
            'time_increment': time_increment,
            'date_preset': date_preset,
        }
        if breakdowns:
            params['breakdowns'] = breakdowns
        if action_breakdowns:
            params['action_breakdowns'] = action_breakdowns

        if extra_params:
            params.update(extra_params)
            
        logger.info(f"Requesting insights for account {self.ad_account_id} with params: {params} and {len(fields)} fields.")
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # --- 核心修改點 ---
                # 1. 使用同步模式 (is_async=False 或不寫)
                # 2. SDK 的 get_insights 在同步模式下會發起 GET 請求
                # 3. SDK 會自動處理 fields 列表，將其轉換為 "field1,field2,..."
                insights_iterator = self.account.get_insights(
                    fields=fields,
                    params=params,
                )
                
                # 將回傳的迭代器轉換為列表
                insights_data = list(insights_iterator)
                
                logger.info(f"Successfully fetched {len(insights_data)} insights records for account {self.ad_account_id}.")
                return insights_data

            except FacebookRequestError as e:
                # 記錄詳細的錯誤日誌，包含 API 回傳的內容
                logger.error(
                    f"Facebook API request error on attempt {attempt + 1}/{max_retries} for account {self.ad_account_id}: \n"
                    f"  Message: {e.api_error_message()}\n"
                    f"  Method:  {e.request_context().get('method')}\n"
                    f"  Path:    {e.request_context().get('path')}\n"
                    f"  Params:  {e.request_context().get('params')}\n"
                    f"\n"
                    f"  Status:  {e.http_status()}\n"
                    f"  Response:\n    {json.dumps(e.body(), indent=4)}\n"
                )

                # 如果是權杖錯誤，直接拋出異常，讓 view 層捕捉
                if e.api_error_code() == 190:
                    logger.error("Access token is invalid or expired. Raising exception.")
                    raise e # 向上拋出，讓 form_valid 知道授權失敗

                # 如果不是暫時性錯誤，或已達最大重試次數，就拋出異常
                is_transient = hasattr(e, 'api_transient_error') and e.api_transient_error()
                if not is_transient or attempt == max_retries - 1:
                    raise e
                
                # 如果是暫時性錯誤，則等待後重試
                logger.info(f"Transient error, will retry in {5 * (attempt + 1)} seconds...")
                time.sleep(5 * (attempt + 1))

            except Exception as e:
                logger.error(f"Unexpected error on attempt {attempt + 1}/{max_retries} for insights: {e}", exc_info=True)
                if attempt == max_retries - 1:
                    raise e # 達到最大重試次數後，拋出異常

        return [] # 如果所有重試都失敗，返回空列表

def get_facebook_ads_page_context(user_access_token=None): # Added user_access_token
    """
    準備用於 Facebook Ads 相關頁面的上下文數據。
    If user_access_token is provided, it will be used to attempt fetching ad accounts.
    Otherwise, or if fetching fails, ad accounts list will be empty or error indicated.
    """
    context_to_return = {
        "is_facebook_ads": True,
        "facebook_app_id": settings.FACEBOOK_APP_ID,
        "facebook_fields_json": "{}", 
        "facebook_ad_accounts": [],
        "facebook_ad_accounts_error": None,
        "facebook_fields_error": None, 
    }

    # --- 步驟 1: 載入完整的 JSON 檔案 ---
    json_file_path = os.path.join(settings.BASE_DIR, 'apps', 'connections', 'apis', 'static_data', 'facebook_fields.json')
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            # 讀取檔案內容並直接轉換成 JSON 字串
            facebook_fields_data = json.load(f)
            context_to_return['facebook_fields_json'] = json.dumps(facebook_fields_data)
            logger.info(f"成功從 {json_file_path} 載入完整的欄位資料。")
            
    except FileNotFoundError:
        error_msg = f"找不到 Facebook 欄位設定檔：{json_file_path}"
        logger.error(error_msg)
        context_to_return['facebook_fields_error'] = error_msg
    except json.JSONDecodeError:
        error_msg = f"Facebook 欄位設定檔格式錯誤：{json_file_path}"
        logger.error(error_msg)
        context_to_return['facebook_fields_error'] = error_msg

    # Use provided user_access_token if available, otherwise fallback to dev token for field definitions
    # For fetching ad accounts, user_access_token is preferred.
    token_for_api = user_access_token or getattr(settings, 'FACEBOOK_ACCESS_TOKEN', None)
    app_id_setting = getattr(settings, 'FACEBOOK_APP_ID', None)
    app_secret_setting = getattr(settings, 'FACEBOOK_APP_SECRET', None)

    if not all([app_id_setting, app_secret_setting, token_for_api]):
        error_msg = "Core Facebook API credentials (App ID, App Secret, Access Token) are not configured or available. Cannot initialize FacebookAdsAPIClient."
        logger.error(error_msg)
        context_to_return["facebook_fields_error"] = "Facebook API client initialization credentials are not properly configured. Please contact support."
        # Also set ad accounts error if we can't even init the client
        context_to_return["facebook_ad_accounts_error"] = "Cannot fetch ad accounts due to API configuration issues."
        return context_to_return # Early exit if core creds missing

    try:
        # Instantiate the client.
        # ad_account_id is not essential for _load_fields_from_static_json or get_ad_accounts
        fb_client = FacebookAdsAPIClient(
            app_id=app_id_setting,
            app_secret=app_secret_setting,
            access_token=token_for_api # Use the determined token
        )
        
        # Fetch ad accounts ONLY if a user_access_token was explicitly provided
        if user_access_token:
            try:
                fb_client = FacebookAdsAPIClient(
                    app_id=settings.FACEBOOK_APP_ID,
                    app_secret=settings.FACEBOOK_APP_SECRET,
                    access_token=token_for_api
                )
                ad_accounts = fb_client.get_ad_accounts()
                if ad_accounts:
                    context_to_return["facebook_ad_accounts"] = ad_accounts
                    logger.info(f"Successfully fetched {len(ad_accounts)} Facebook ad accounts.")
                else:
                    logger.warning("No Facebook ad accounts found or an error occurred during fetching with user_access_token.")
                    # Check if an error was logged by get_ad_accounts (e.g. token invalid)
                    # Providing a generic message here as specific errors are logged within get_ad_accounts
                    context_to_return["facebook_ad_accounts_error"] = "Could not retrieve ad accounts. The access token might be invalid, have insufficient permissions, or there are no active ad accounts."
            except Exception as e:
                logger.error(f"Error fetching Facebook ad accounts: {e}", exc_info=True)
                context_to_return["facebook_ad_accounts_error"] = f"Could not retrieve ad accounts. An error occurred: {e}" 
        else:
            logger.info("User access token not provided to get_facebook_ads_page_context; skipping ad account fetch.")
            context_to_return["facebook_ad_accounts_error"] = "User authentication required to fetch ad accounts."


    except FacebookRequestError as e: # Catch errors from FacebookAdsAPIClient init
        logger.error(f"Facebook API Request Error during FacebookAdsAPIClient instantiation or field/account loading: {e}", exc_info=True)
        context_to_return["facebook_fields_error"] = f"Facebook API error: {e}. Please contact support."
        context_to_return["facebook_ad_accounts_error"] = f"Cannot fetch ad accounts due to Facebook API error: {e}."
        if e.api_error_code() == 190:
            context_to_return["facebook_ad_accounts_error"] = "Facebook access token is invalid or expired. Please re-authorize."
            context_to_return["facebook_fields_error"] = "Facebook access token is invalid or expired. Cannot load field definitions."

    except Exception as e:
        logger.error(f"Unexpected error during FacebookAdsAPIClient operations for context: {e}", exc_info=True)
        context_to_return["facebook_fields_error"] = f"An unexpected error occurred regarding Facebook configuration: {e}. Please contact support."
        context_to_return["facebook_ad_accounts_error"] = f"Unexpected error fetching ad accounts: {e}."
            
    return context_to_return

def get_facebook_oauth_url(request, client_id):
    """
    生成 Facebook OAuth 授權 URL。
    
    Args:
        request: Django request 對象
        client_id: 客戶端 ID (can be any string for state, using client_id for convenience)
        
    Returns:
        tuple: (auth_url, redirect_uri)
    """
    redirect_uri = request.build_absolute_uri(reverse('connections:facebook_oauth_callback'))
    redirect_uri = redirect_uri.replace('http://', 'https://')
    
    logger.info(f"Facebook OAuth redirect URI: {redirect_uri}")
    
    scope = 'ads_management,ads_read,business_management,pages_read_engagement,pages_show_list,read_insights' # Added read_insights
    
    auth_url = (
        f"https://www.facebook.com/v18.0/dialog/oauth"
        f"?client_id={settings.FACEBOOK_APP_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&state={client_id}" 
    )
    
    logger.info(f"Facebook OAuth auth URL: {auth_url}")
    
    return auth_url, redirect_uri

def get_facebook_field_choices():
    """
    從靜態 JSON 檔案中讀取 Facebook 欄位，並將其格式化為
    Django Form ChoiceField 需要的 (value, label) 元組列表。
    """
    json_file_path = os.path.join(settings.BASE_DIR, 'apps', 'connections', 'apis', 'static_data', 'facebook_fields.json')
    logger.info(f"從 {json_file_path} 載入 Facebook 欄位選項。")
    
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        unique_fields = {} # 使用字典來確保欄位的唯一性

        # 遍歷所有層級 (campaign, ad_set, ad)
        for level_key, level_data in data.items():
            if not isinstance(level_data, dict):
                continue
            
            # 遍歷每個層級下的欄位類型 (breakdowns, action_breakdowns, fields)
            for field_type in ['breakdowns', 'action_breakdowns', 'fields']:
                fields_list = level_data.get(field_type, [])
                for field in fields_list:
                    if isinstance(field, dict) and 'name' in field and 'label' in field:
                        # 使用 field['name'] 作為鍵，避免重複
                        unique_fields[field['name']] = field['label']

        if not unique_fields:
            logger.warning(f"{json_file_path} 檔案已載入，但未找到任何欄位。")
            return []

        # 將字典轉換為 (value, label) 的元組列表
        choices = list(unique_fields.items())
        
        # 按字母順序排序 (按 label)
        choices.sort(key=lambda x: x[1])
        
        logger.info(f"成功從 JSON 檔案載入並格式化了 {len(choices)} 個唯一的欄位選項。")
        return choices

    except FileNotFoundError:
        logger.error(f"找不到靜態 Facebook 欄位 JSON 檔案：{json_file_path}")
    except json.JSONDecodeError:
        logger.error(f"解碼 Facebook 欄位 JSON 檔案時出錯：{json_file_path}")
    except Exception as e:
        logger.error(f"載入 Facebook 欄位時發生未知錯誤：{e}", exc_info=True)
    
    return [] # 如果出錯，返回一個空列表