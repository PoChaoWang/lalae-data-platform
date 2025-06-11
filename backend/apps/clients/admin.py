from django.contrib import admin
from .models import Client, ClientSetting

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'bigquery_dataset_id', 'is_active', 'created_at', 'created_by', 'updated_at', 'updated_by')
    search_fields = ('name', 'bigquery_dataset_id')
    list_filter = ('is_active', 'created_at', 'updated_at')
    readonly_fields = ('bigquery_dataset_id', 'created_at', 'updated_at', 'created_by', 'updated_by')

@admin.register(ClientSetting)
class ClientSettingAdmin(admin.ModelAdmin):
    list_display = ('client', 'user', 'is_owner', 'can_edit', 'can_view_gcp', 'can_manage_gcp', 'created_at', 'updated_at')
    search_fields = ('client__name', 'user__username')
    list_filter = ('is_owner', 'can_edit', 'can_view_gcp', 'can_manage_gcp')
    readonly_fields = ('created_at', 'updated_at')
