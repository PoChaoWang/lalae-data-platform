# clients/models.py
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid
import hashlib
from django.conf import settings
from allauth.socialaccount.models import SocialAccount, SocialToken
from .tasks import create_bigquery_dataset_and_tables_task
from django.contrib.auth.models import User

class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    bigquery_dataset_id = models.CharField(max_length=100, unique=True, blank=True, null=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='clients_created',
        null=True,
        blank=True
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='clients_updated',
        null=True,
        blank=True
    )

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        request = kwargs.pop('request', None)
        if request and request.user.is_authenticated:
            if not self.pk:  # New instance
                self.created_by = request.user
            self.updated_by = request.user

        if not self.pk and not self.bigquery_dataset_id:  # New instance
            # Generate a unique BigQuery dataset ID
            timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
            base_string = f"{self.name}_{timestamp}_{self.created_by.username if self.created_by else ''}"
            hash_object = hashlib.sha256(base_string.encode())
            self.bigquery_dataset_id = f"client_{hash_object.hexdigest()[:16]}"

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Import here to avoid circular imports
        from .tasks import delete_bigquery_dataset_task
        if self.bigquery_dataset_id:
            delete_bigquery_dataset_task.delay(self.bigquery_dataset_id)
        super().delete(*args, **kwargs)

    def create_bigquery_dataset_async(self, user_id=None):
        if self.bigquery_dataset_id:
            create_bigquery_dataset_and_tables_task.delay(self.bigquery_dataset_id, user_id)

    def save_client_setting(self, user, is_owner=False, can_edit=False, can_view_gcp=False, can_manage_gcp=False):
        """Save or update client setting for a user.
        
        Args:
            user: The user to set permissions for
            is_owner: Whether the user is an owner
            can_edit: Whether the user can edit
            can_view_gcp: Whether the user can view GCP resources
            can_manage_gcp: Whether the user can manage GCP resources
        """
        ClientSetting.objects.update_or_create(
            client=self,
            user=user,
            defaults={
                'is_owner': is_owner,
                'can_edit': can_edit,
                'can_view_gcp': can_view_gcp,
                'can_manage_gcp': can_manage_gcp,
            }
        )

    def share_with_user(self, user, can_edit=False, can_view_gcp=False, can_manage_gcp=False):
        """Share client with another user.
        
        Args:
            user: The user to share with
            can_edit: Whether the user can edit
            can_view_gcp: Whether the user can view GCP resources
            can_manage_gcp: Whether the user can manage GCP resources
        """
        self.save_client_setting(
            user=user,
            is_owner=False,  # 共享用戶不能是擁有者
            can_edit=can_edit,
            can_view_gcp=can_view_gcp,
            can_manage_gcp=can_manage_gcp
        )

    def unshare_from_user(self, user):
        """Remove sharing from a user.
        
        Args:
            user: The user to remove sharing from
        """
        ClientSetting.objects.filter(client=self, user=user).delete()

    def get_user_settings(self, user):
        """Get client settings for a specific user.
        
        Args:
            user: The user to get settings for
            
        Returns:
            ClientSetting object or None if not found
        """
        try:
            return ClientSetting.objects.get(client=self, user=user)
        except ClientSetting.DoesNotExist:
            return None

    def get_all_shared_users(self):
        """Get all users who have access to this client.
        
        Returns:
            QuerySet of User objects
        """
        return User.objects.filter(client_settings__client=self)

    class Meta:
        verbose_name = "Client"
        verbose_name_plural = "Clients"

class ClientSetting(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='settings')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='client_settings')
    is_owner = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_view_gcp = models.BooleanField(default=False, help_text="Can view GCP resources")
    can_manage_gcp = models.BooleanField(default=False, help_text="Can manage GCP resources")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'user')
        verbose_name = "Client Setting"
        verbose_name_plural = "Client Settings"

    def __str__(self):
        return f"{self.client.name} - {self.user.username}"

class ClientSocialAccount(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='linked_social_accounts')
    social_account = models.ForeignKey(SocialAccount, on_delete=models.CASCADE, related_name='linked_clients')
    added_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('client', 'social_account') # 確保一個 Client 和一個 SocialAccount 只有一個關聯
        verbose_name = "Client Social Account Link"
        verbose_name_plural = "Client Social Account Links"

    def __str__(self):
        return f"{self.client.name} - {self.social_account.provider.capitalize()}: {self.social_account.uid}"

    def get_token(self):
        """獲取關聯 SocialAccount 的最新 SocialToken"""
        # 確保獲取到的是針對此 SocialAccount 的 token
        return SocialToken.objects.filter(account=self.social_account).order_by('-pk').first()

    def get_display_name(self):
        """用於前端顯示 SocialAccount 的名稱"""
        return self.social_account.extra_data.get('name') or \
               self.social_account.extra_data.get('email') or \
               self.social_account.uid
               
    def is_token_valid(self):
        """檢查 token 是否有效且未過期"""
        token_obj = self.get_token()
        if not token_obj or not token_obj.token:
            return False
        # 對於 Google，檢查 expires_at
        if token_obj.app.provider == 'google' and token_obj.expires_at:
            return token_obj.expires_at > timezone.now()
        # 對於 Facebook (長效 token 通常沒有 expires_at 或很長)，只檢查 token 存在即可
        # 更嚴謹的檢查可能需要打 API 驗證 token
        return True
