from django.db import models
from django.conf import settings # To get the User model
from django.contrib.auth.models import User
from allauth.socialaccount.models import SocialToken, SocialAccount
from apps.clients.models import Client
import json
import pytz

timezone = pytz.timezone('Asia/Taipei')

class DataSource(models.Model):
    """儲存支援的資料來源類型，方便管理"""
    SOURCE_CHOICES = [
        ('GOOGLE_ADS', 'Google Ads'),
        ('FACEBOOK_ADS', 'Facebook Ads'),
        ('GOOGLE_SHEET', 'Google Sheet'),
        ('CSV', 'CSV File'),
    ]
    name = models.CharField(max_length=50, choices=SOURCE_CHOICES, unique=True)
    display_name = models.CharField(max_length=255, default='Default Name')
    oauth_required = models.BooleanField(default=True)  
    required_scopes = models.JSONField(default=list) 
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    

    def __str__(self):
        return self.display_name

    def get_required_scopes(self):
        """Get the required OAuth scopes for this data source"""
        base_scopes = [
            'https://www.googleapis.com/auth/bigquery.readonly',
            'https://www.googleapis.com/auth/bigquerydatatransfer.readonly',
            'https://www.googleapis.com/auth/bigquerydatatransfer.write'
        ]
        
        if self.name == 'GOOGLE_ADS':
            base_scopes.extend([
                'https://www.googleapis.com/auth/adwords.readonly'
            ])
        elif self.name == 'YOUTUBE_CHANNEL':
            base_scopes.extend([
                'https://www.googleapis.com/auth/youtube.readonly'
            ])
        elif self.name == 'GOOGLE_PLAY':
            base_scopes.extend([
                'https://www.googleapis.com/auth/androidpublisher'
            ])
        elif self.name == 'GOOGLE_AD_MANAGER':
            base_scopes.extend([
                'https://www.googleapis.com/auth/dfp'
            ])
            
        return base_scopes

class Connection(models.Model):
    """代表一個使用者建立的資料連接"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),   # 待處理
        ('ACTIVE', 'Active'),     # 活動中 (正常)
        ('SYNCING', 'Syncing'),   # 同步中
        ('ERROR', 'Error'),       # 發生錯誤
    ]
    
    # --- 核心關聯欄位 ---
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    data_source = models.ForeignKey(DataSource, on_delete=models.CASCADE)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True)
    social_account = models.ForeignKey(
        SocialAccount, 
        on_delete=models.SET_NULL, # 建議用 SET_NULL，避免刪除 social account 時連帶刪除 connection
        null=True, 
        blank=True,
        help_text="關聯的社交帳號用於 OAuth"
    )

    # --- 基本資訊 ---
    display_name = models.CharField(max_length=200)
    target_dataset_id = models.CharField(max_length=200)
    config = models.JSONField(default=dict, blank=True)
    
    # --- 狀態與同步紀錄 (合併後的版本) ---
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE'
    )
    last_sync_time = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="The timestamp of the last sync attempt."
    )
    last_sync_status = models.TextField(
        null=True, 
        blank=True,
        help_text="A message describing the result of the last sync (e.g., SUCCESS, or the error message)."
    )
    last_sync_record_count = models.IntegerField(
        null=True, 
        blank=True,
        help_text="The number of records fetched in the last successful sync."
    )

    # --- 時間戳 ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # --- 其他特定用途欄位 (例如 Google DTS) ---
    dts_transfer_config_name = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        unique_together = ['user', 'data_source', 'display_name']
    
    def __str__(self):
        return f"{self.display_name} ({self.data_source.get_name_display()})"
    
    def get_access_token(self):
        """獲取有效的 access token"""
        if not self.social_account:
            return None
            
        try:
            social_token = SocialToken.objects.get(
                account=self.social_account,
                app__provider='google'
            )
            
            # 檢查 token 是否過期，如果過期則刷新
            if social_token.expires_at and social_token.expires_at < timezone.now():
                # 這裡可以實作 token 刷新邏輯
                self.refresh_token()
            
            return social_token.token
        except SocialToken.DoesNotExist:
            return None
    
    def refresh_token(self):
        """刷新 access token"""
        # 實作 token 刷新邏輯
        pass

class GoogleAdsField(models.Model):
    """儲存從 Google Ads API 獲取的欄位元數據"""
    CATEGORY_CHOICES = [
        ('ATTRIBUTE', 'Attribute'),
        ('METRIC', 'Metric'),
        ('SEGMENT', 'Segment'),
    ]

    field_name = models.CharField(max_length=255, unique=True, help_text="完整的 API 欄位名稱，例如 'metrics.clicks'")
    display_name = models.CharField(max_length=255, help_text="顯示在 UI 上的名稱，例如 'Clicks'")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    data_type = models.CharField(max_length=50)
    is_selectable = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = "Google Ads Field"
        verbose_name_plural = "Google Ads Fields"
        ordering = ['category', 'display_name']

    def __str__(self):
        return f"{self.display_name} ({self.field_name})"

