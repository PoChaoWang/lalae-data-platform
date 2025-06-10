from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Profile(models.Model):
    # 使用 OneToOneField 將 Profile 連接到一個 User 實例
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    # 定義角色選項，方便管理
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        USER = 'USER', 'User'

    # 您的 role 欄位
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USER,
    )

    def __str__(self):
        return f'{self.user.username} Profile ({self.get_role_display()})'

# (推薦) 使用 Signal，在每次建立 User 時自動建立對應的 Profile
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        profile = Profile.objects.create(user=instance)
        if instance.is_superuser:
            profile.role = Profile.Role.ADMIN
            profile.save()

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()
# Create your models here.
