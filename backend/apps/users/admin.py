from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Profile

# 將您的 Model 註冊到 Admin 網站
admin.site.register(Profile)
