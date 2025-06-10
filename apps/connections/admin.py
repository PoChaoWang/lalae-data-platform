from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import DataSource, Connection, ConnectionExecution, GoogleAdsField 

# 將您的 Model 註冊到 Admin 網站
admin.site.register(DataSource)
admin.site.register(Connection)
admin.site.register(ConnectionExecution)
admin.site.register(GoogleAdsField)