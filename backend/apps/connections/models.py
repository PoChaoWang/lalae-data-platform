from django.db import models
from django.conf import settings # To get the User model
from django.contrib.auth.models import User
from allauth.socialaccount.models import SocialToken, SocialAccount
from apps.clients.models import Client
import json
import pytz
from django.core.cache import cache

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
    required_scopes = models.JSONField(default=list, blank=True) 
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
    
    # --- Core Columns ---
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    data_source = models.ForeignKey(DataSource, on_delete=models.CASCADE)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True)
    social_account = models.ForeignKey(
        SocialAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Only set if the data source requires OAuth authentication."
    )

    # --- Basic Settings ---
    display_name = models.CharField(max_length=200)
    target_dataset_id = models.CharField(max_length=200)
    config = models.JSONField(default=dict, blank=True)
    
    # --- Status ---
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE'
    )
    is_enabled = models.BooleanField(
        default=True,
        help_text="控制此連線的排程是否啟用 (On/Off)"
    )

    # --- Timestamp ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'data_source', 'display_name']

    def __str__(self):
        return f"{self.display_name} ({self.data_source.get_name_display()})"
    
    def get_last_execution_cached(self):
        """
        獲取最近一次執行紀錄並快取。
        """
        cache_key = f"last_execution_connection_{self.pk}"
        last_execution = cache.get(cache_key)
        
        if last_execution is None:
            last_execution = self.executions.order_by('-started_at').first()
            if last_execution:
                # 快取 1 分鐘，因為執行狀態可能快速變化
                cache.set(cache_key, last_execution, 60) 
        return last_execution
    
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

class ConnectionExecution(models.Model):
    STATUS_CHOICES = [
        ('RUNNING', 'Running'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]
    TRIGGER_CHOICES = [
        ('SYSTEM', 'System'),
        ('MANUAL', 'Manual'),
    ]

    connection = models.ForeignKey(Connection, on_delete=models.CASCADE, related_name='executions')
    triggered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, help_text="If the task was triggered by a user")
    trigger_method = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default='SYSTEM')

    # --- 執行結果 ---
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    message = models.TextField(blank=True, null=True, help_text="Result message")
    record_count = models.IntegerField(null=True, blank=True, help_text="Sync record count")

    # --- 執行當下的快照 ---
    config_snapshot = models.JSONField(help_text="Connection config at the time of execution")
    display_name_snapshot = models.CharField(max_length=200, help_text="Display name at the time of execution")
    target_dataset_id_snapshot = models.CharField(max_length=200, help_text="Target dataset ID at the time of execution")

    # --- 時間戳 ---
    started_at = models.DateTimeField(auto_now_add=True, help_text="Task start time")
    finished_at = models.DateTimeField(null=True, blank=True, help_text="Task finish time")

    class Meta:
        verbose_name = "Connection Execution"
        verbose_name_plural = "Connection Executions"
        ordering = ['-started_at']

    def __str__(self):
        return f" {self.display_name_snapshot} execution @ {self.started_at.strftime('%Y-%m-%d %H:%M')}"

class GoogleAdsField(models.Model):
    CATEGORY_CHOICES = [
        ('ATTRIBUTE', 'Attribute'),
        ('METRIC', 'Metric'),
        ('SEGMENT', 'Segment'),
    ]

    field_name = models.CharField(max_length=255, unique=True, help_text="Full API field name, e.g. 'metrics.clicks'")
    display_name = models.CharField(max_length=255, help_text="UI display name, e.g. 'Clicks'")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    group = models.CharField(max_length=50, blank=True, null=True, help_text="User-friendly group name")
    data_type = models.CharField(max_length=50)
    is_selectable = models.BooleanField(default=False)

    compatible_fields = models.ManyToManyField('self', symmetrical=False, related_name='+', blank=True)
    
    class Meta:
        verbose_name = "Google Ads Field"
        verbose_name_plural = "Google Ads Fields"
        ordering = ['category', 'display_name']

    def __str__(self):
        return f"{self.display_name} ({self.field_name})"
    
class FacebookAdsField(models.Model):
    name = models.CharField(max_length=255, help_text="The internal name of the Facebook Ads field.")
    label = models.CharField(max_length=255, help_text="The display label of the Facebook Ads field.")
    insights_level = models.CharField(max_length=50, help_text="The insights level this field belongs to (e.g., 'campaign', 'ad_set', 'ad').")
    field_type = models.CharField(max_length=50, help_text="Type of field: 'breakdown', 'action_breakdown', or 'field'.")

    class Meta:
        verbose_name = "Facebook Ads Field"
        verbose_name_plural = "Facebook Ads Fields"
        unique_together = ('name', 'insights_level')

    def __str__(self):
        return f"[{self.insights_level}] {self.label} ({self.name})"

