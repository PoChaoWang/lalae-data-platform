from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.dispatch import receiver
from .models import Profile

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        # 將 create() 改成 get_or_create()
        Profile.objects.get_or_create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    # 這裡的 save() 通常不會有問題，因為它是在更新已存在的 profile
    # 但為了以防萬一，可以加上 try-except
    try:
        instance.profile.save()
    except Profile.DoesNotExist:
        # 如果因為某些極端原因 profile 還沒建立，就在這裡補上
        Profile.objects.create(user=instance)