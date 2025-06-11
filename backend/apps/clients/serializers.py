# clients/serializers.py

from rest_framework import serializers
from .models import Client

class ClientSerializer(serializers.ModelSerializer):
    # 將 created_by (ForeignKey) 顯示為使用者的 username 字串
    # 設為 read_only 因為它是由系統自動設定，不應由使用者從 API 傳入
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Client
        # 定義您希望在 API 中顯示的所有欄位
        fields = [
            'id',
            'name',
            'is_active',
            'bigquery_dataset_id',
            'created_at',
            'created_by' # DRF 會自動處理關聯欄位和 datetime
        ]
        # 如果有不希望使用者能透過 API 修改的欄位，可以放在 read_only_fields
        read_only_fields = ['bigquery_dataset_id', 'created_at', 'created_by']