# apps/users/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from dj_rest_auth.registration.serializers import RegisterSerializer 
from allauth.account.adapter import get_adapter

User = get_user_model() 

class CustomRegisterSerializer(RegisterSerializer):
    # dj_rest_auth 預設的 RegisterSerializer 已經有 email 和 password
    # 我們只需要額外加入 username 和 password2 (用於密碼確認)
    
    username = serializers.CharField(max_length=150, required=True)
    # email = serializers.EmailField(required=True)
    first_name = serializers.CharField(max_length=30, required=True)
    last_name = serializers.CharField(max_length=30, required=True)
    # password2 = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    # def validate_username(self, username):
    #     # 檢查使用者名稱是否已經存在
    #     if User.objects.filter(username=username).exists():
    #         raise serializers.ValidationError("A user with that username already exists.")
    #     return username
    
    # def validate(self, data):
    #     super().validate(data)
    #     email = data.get('email')
    #     if email and User.objects.filter(email__iexact=email).exists():
    #         # 如果存在，就引發一個驗證錯誤，前端將會收到這個訊息。
    #         raise serializers.ValidationError(
    #             {"email": "The email address is already in use."}
    #         )
    #     return data

        
    def get_cleaned_data(self):
        return {
            'username': self.validated_data.get('username', ''),
            'password1': self.validated_data.get('password1', ''),
            'password2': self.validated_data.get('password2', ''),
            'email': self.validated_data.get('email', ''),
            'first_name': self.validated_data.get('first_name', ''),
            'last_name': self.validated_data.get('last_name', ''),
        }
    
    # def save(self, request):
    #     user = super().save(request)
    #     user.username = self.validated_data.get('username', '')
    #     user.first_name = self.validated_data.get('first_name', '')
    #     user.last_name = self.validated_data.get('last_name', '')
    #     user.save()
    #     return user

class UserSerializer(serializers.ModelSerializer):
    """
    用於序列化使用者物件的 Serializer
    """
    class Meta:
        model = User
        fields = ['pk', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ('pk',)