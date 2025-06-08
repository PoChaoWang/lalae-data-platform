from django.test import TestCase, Client as TestClient
from django.urls import reverse
from django.contrib.auth import get_user_model
from .models import Connection, DataSource
from apps.clients.models import Client
from allauth.socialaccount.models import SocialAccount, SocialToken
from django.conf import settings
from unittest.mock import patch, MagicMock
from .apis.google_oauth import setup_dts_transfer as api_setup_dts_transfer

User = get_user_model()

# class ConnectionModelTest(TestCase):
#     def setUp(self):
#         # 創建測試用戶
#         self.user = User.objects.create_user(
#             username='testuser',
#             email='test@example.com',
#             password='testpass123'
#         )
        
#         # 創建測試客戶
#         self.client_dataset = Client.objects.create(
#             name='Test Client',
#             bigquery_dataset_id='test_dataset',
#             created_by=self.user
#         )
        
#         # 創建測試資料來源
#         self.data_source = DataSource.objects.create(
#             name='GOOGLE_ADS',
#             display_name='Google Ads',
#             oauth_required=True,
#             required_scopes=['https://www.googleapis.com/auth/bigquery']
#         )
        
#         # 創建測試連接
#         self.connection = Connection.objects.create(
#             user=self.user,
#             data_source=self.data_source,
#             display_name='Test Connection',
#             target_dataset_id='test_dataset',
#             is_active=True
#         )

#     def test_connection_creation(self):
#         """測試連接創建"""
#         self.assertEqual(self.connection.user, self.user)
#         self.assertEqual(self.connection.data_source, self.data_source)
#         self.assertEqual(self.connection.display_name, 'Test Connection')
#         self.assertEqual(self.connection.target_dataset_id, 'test_dataset')
#         self.assertTrue(self.connection.is_active)

#     def test_connection_str(self):
#         """測試連接的字串表示"""
#         expected_str = f"{self.connection.display_name} ({self.data_source.get_name_display()})"
#         self.assertEqual(str(self.connection), expected_str)

class FacebookAdsConnectionTest(TestCase):
    def setUp(self):
        # 創建測試用戶
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # 創建測試客戶
        self.client_dataset = Client.objects.create(
            name='Test Client',
            bigquery_dataset_id='test_client_dataset_2024',
            created_by=self.user
        )
        
        # 刪除已存在的 FACEBOOK_ADS DataSource
        DataSource.objects.filter(name='FACEBOOK_ADS').delete()
        
        # 創建測試資料來源
        self.data_source = DataSource.objects.create(
            name='FACEBOOK_ADS',
            display_name='Facebook Ads',
            oauth_required=True,
            required_scopes=['ads_read']
        )
        
        # 創建測試客戶端
        self.client = TestClient()
        self.client.login(username='testuser', password='testpass123')

        # 創建 Facebook SocialAccount
        self.social_app = SocialAccount.objects.create(
            user=self.user,
            provider='facebook',
            uid='123456789',
            extra_data={
                'name': 'Test User',
                'id': '123456789',
                'access_token': 'test_access_token'
            }
        )

        # 創建 OAuth 客戶端
        from allauth.socialaccount.models import SocialApp
        self.oauth_client = SocialApp.objects.create(
            provider='facebook',
            name='Facebook OAuth Client',
            client_id='test_client_id',
            secret='test_client_secret'
        )

    def test_facebook_connection_list_view(self):
        """測試 Facebook Ads 連接列表視圖"""
        url = reverse('connections:connection_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'connections/connection_list.html')

    def test_facebook_connection_create_view(self):
        """測試 Facebook Ads 連接創建視圖"""
        url = reverse('connections:connection_create', kwargs={'source_name': 'FACEBOOK_ADS'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'connections/connection_form.html')

    def test_facebook_connection_create_post(self):
        """測試 Facebook Ads 連接創建 POST 請求"""
        url = reverse('connections:connection_create', kwargs={'source_name': 'FACEBOOK_ADS'})
        data = {
            'display_name': 'New Facebook Test Connection',
            'facebook_ad_account_id': '123456789',
            'target_dataset_id': 'test_client_dataset_2024',
            'sync_frequency': 'daily',
            'selected_fields_hidden': '["impressions", "clicks", "spend"]',
            'date_range_type': 'preset',
            'date_preset': 'last_30d',
            'facebook_access_token': 'test_access_token',
            'selected_fields': ['impressions', 'clicks', 'spend'],
            'insights_level': 'ad',
            'client_id': str(self.oauth_client.id)
        }
        response = self.client.post(url, data)
        
        # 調試信息
        if response.status_code != 302:
            print(f"Response status: {response.status_code}")
            if hasattr(response, 'context') and response.context:
                form = response.context.get('form')
                if form and hasattr(form, 'errors'):
                    print(f"Form errors: {form.errors}")
        
        self.assertEqual(response.status_code, 302)

    def test_facebook_connection_create_post_no_social_account(self):
        """測試沒有 Facebook 社交帳號時的連接創建 POST 請求"""
        # 刪除現有的社交帳號
        self.social_app.delete()
        
        url = reverse('connections:connection_create', kwargs={'source_name': 'FACEBOOK_ADS'})
        data = {
            'display_name': 'New Facebook Test Connection',
            'facebook_ad_account_id': '123456789',
            'target_dataset_id': 'test_client_dataset_2024',
            'sync_frequency': 'daily',
            'selected_fields_hidden': '["impressions", "clicks", "spend"]',
            'date_range_type': 'preset',
            'date_preset': 'last_30d',
            'facebook_access_token': 'test_access_token',
            'selected_fields': ['impressions', 'clicks', 'spend'],
            'insights_level': 'ad',
            'client_id': str(self.oauth_client.id)
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 302)
        print(f"實際重定向 URL: {response.url}")

    def test_facebook_connection_form_validation(self):
        """測試 Facebook Ads 連接表單驗證"""
        from apps.connections.forms import ConnectionForm
        
        # 測試有效數據
        form_data = {
            'display_name': 'Test Facebook Connection',
            'facebook_ad_account_id': '123456789',
            'target_dataset_id': 'test_client_dataset_2024',
            'sync_frequency': 'daily',
            'selected_fields_hidden': '["impressions", "clicks", "spend"]',
            'date_range_type': 'preset',
            'date_preset': 'last_30d',
            'facebook_access_token': 'test_access_token',
            'selected_fields': ['impressions', 'clicks', 'spend'],
            'insights_level': 'ad',
            'client_id': str(self.oauth_client.id)
        }
        form = ConnectionForm(data=form_data, data_source_instance=self.data_source, user=self.user)
        
        # 調試表單錯誤
        if not form.is_valid():
            print("=== Form Validation Errors ===")
            print(f"Form errors: {form.errors}")
            print(f"Form data: {form_data}")
            print(f"Available clients: {[c.bigquery_dataset_id for c in Client.objects.filter(created_by=self.user)]}")
        
        self.assertTrue(form.is_valid(), f"Form should be valid but has errors: {form.errors}")
        
        # 測試無效數據 - 空的 display_name
        invalid_form_data = {
            'display_name': '',  # 必填欄位
            'facebook_ad_account_id': '123456789',
            'target_dataset_id': 'test_client_dataset_2024',
            'sync_frequency': 'daily',
            'selected_fields_hidden': '["impressions", "clicks", "spend"]',
            'date_range_type': 'preset',
            'date_preset': 'last_30d',
            'facebook_access_token': 'test_access_token',
            'selected_fields': ['impressions', 'clicks', 'spend'],
            'insights_level': 'ad',
            'client_id': str(self.oauth_client.id)
        }
        invalid_form = ConnectionForm(data=invalid_form_data, data_source_instance=self.data_source, user=self.user)
        self.assertFalse(invalid_form.is_valid())
        self.assertIn('display_name', invalid_form.errors)
        
        # 測試缺少必要欄位的情況
        missing_fields_form_data = {
            'display_name': 'Test Facebook Connection',
            'target_dataset_id': 'test_client_dataset_2024',
            'sync_frequency': 'daily',
            'client_id': str(self.oauth_client.id)
            # 缺少 facebook_ad_account_id, selected_fields_hidden, facebook_access_token, selected_fields, insights_level
        }
        missing_fields_form = ConnectionForm(data=missing_fields_form_data, data_source_instance=self.data_source, user=self.user)
        self.assertFalse(missing_fields_form.is_valid())
        self.assertIn('facebook_ad_account_id', missing_fields_form.errors)

# class ConnectionAPITest(TestCase):
#     def setUp(self):
#         self.user = User.objects.create_user(
#             username='testuser',
#             email='test@example.com',
#             password='testpass123'
#         )
#         self.client = TestClient()
#         self.client.login(username='testuser', password='testpass123')

#     @patch('apps.connections.apis.google_oauth.default')
#     @patch('apps.connections.apis.google_oauth.build')
#     @patch('apps.connections.apis.google_oauth._get_user_oauth_credentials_details')
#     @patch('django.conf.settings.GOOGLE_CLOUD_PROJECT_ID', 'my-project-for-bigquery-445809')
#     def test_setup_dts_transfer(self, mock_get_credentials, mock_build, mock_default):
#         """測試 DTS 配置設置"""
#         # Mock default credentials
#         mock_credentials = MagicMock()
#         mock_default.return_value = (mock_credentials, 'my-project-for-bigquery-445809')
        
#         # Mock BigQuery DTS service - 更明确的 mock 设置
#         mock_service = MagicMock()
#         mock_build.return_value = mock_service
        
#         # 设置链式调用的 mock
#         mock_create = MagicMock()
#         mock_execute = MagicMock()
#         mock_execute.return_value = {'name': 'test-transfer-config'}
#         mock_create.return_value.execute = mock_execute
        
#         mock_service.projects.return_value.locations.return_value.transferConfigs.return_value.create = mock_create
        
#         # Mock user OAuth credentials
#         mock_get_credentials.return_value = {
#             'access_token': 'test-token',
#             'refresh_token': 'test-refresh'
#         }
    
#         # 创建测试资料
#         data_source = DataSource.objects.create(
#             name='GOOGLE_ADS',
#             display_name='Google Ads',
#             oauth_required=True,
#             required_scopes=['https://www.googleapis.com/auth/bigquery']
#         )
#         connection = Connection.objects.create(
#             user=self.user,
#             data_source=data_source,
#             display_name='Test Connection',
#             target_dataset_id='test_dataset',
#             config={'customer_id': '123-456-7890'}
#         )
    
#         # 调用实际函数
#         result = api_setup_dts_transfer(
#             connection_instance=connection,
#             request=None
#         )
        
#         # 验证结果
#         self.assertTrue(result)
        
#         # 验证 create 方法被正确调用
#         expected_parent = "projects/my-project-for-bigquery-445809/locations/us"
#         expected_body = {
#             'destination_dataset_id': 'test_dataset',
#             'display_name': 'Test Connection - GOOGLE_ADS Transfer',
#             'data_source_id': 'google_ads',
#             'params': {
#                 'destination_dataset_id': 'test_dataset',
#                 'customer_id': '123-456-7890',
#                 'access_token': 'test-token',
#                 'refresh_token': 'test-refresh'
#             },
#             'schedule_options': {'disable_auto_scheduling': False}
#         }
        
#         mock_create.assert_called_once_with(parent=expected_parent, body=expected_body)
#         mock_execute.assert_called_once()

# class ConnectionFormTest(TestCase):
#     def setUp(self):
#         self.user = User.objects.create_user(
#             username='testuser',
#             email='test@example.com',
#             password='testpass123'
#         )
#         self.data_source = DataSource.objects.create(
#             name='GOOGLE_ADS',
#             display_name='Google Ads',
#             oauth_required=True,
#             required_scopes=['https://www.googleapis.com/auth/bigquery']
#         )

#     def test_connection_form_validation(self):
#         """測試連接表單驗證"""
#         from apps.connections.forms import ConnectionForm
        
#         # 創建測試客戶
#         client = Client.objects.create(
#             name='Test Client Form',
#             bigquery_dataset_id='test_client_dataset_2024',
#             created_by=self.user
#         )
        
#         # 測試有效數據
#         form_data = {
#             'display_name': 'Test Connection',
#             'customer_id': '123-456-7890',
#             'target_dataset_id': 'test_client_dataset_2024',
#             'sync_frequency': 'daily'
#         }
#         form = ConnectionForm(data=form_data, data_source_instance=self.data_source, user=self.user)
        
#         # 調試表單錯誤
#         if not form.is_valid():
#             print("=== Form Validation Errors ===")
#             print(f"Form errors: {form.errors}")
#             print(f"Form data: {form_data}")
#             print(f"Available clients: {[c.bigquery_dataset_id for c in Client.objects.filter(created_by=self.user)]}")
    
#         self.assertTrue(form.is_valid(), f"Form should be valid but has errors: {form.errors}")
        
#         # 測試無效數據 - 空的 display_name
#         invalid_form_data = {
#             'display_name': '',  # 必填欄位
#             'customer_id': '123-456-7890',
#             'target_dataset_id': 'test_client_dataset_2024',
#             'sync_frequency': 'daily'
#         }
#         invalid_form = ConnectionForm(data=invalid_form_data, data_source_instance=self.data_source, user=self.user)
#         self.assertFalse(invalid_form.is_valid())
#         self.assertIn('display_name', invalid_form.errors)
        
#         # 測試缺少 sync_frequency 的情況
#         missing_sync_form_data = {
#             'display_name': 'Test Connection',
#             'customer_id': '123-456-7890',
#             'target_dataset_id': 'test_client_dataset_2024'
#             # 缺少 sync_frequency
#         }
#         missing_sync_form = ConnectionForm(data=missing_sync_form_data, data_source_instance=self.data_source, user=self.user)
#         self.assertFalse(missing_sync_form.is_valid())
#         self.assertIn('sync_frequency', missing_sync_form.errors)