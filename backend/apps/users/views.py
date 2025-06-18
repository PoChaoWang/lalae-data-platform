from django.contrib import messages
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from allauth.account.views import ConfirmEmailView
from allauth.account.models import EmailConfirmation
from django.http import JsonResponse
from .serializers import UserSerializer
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
import os
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

# @api_view(['POST'])
# @permission_classes([AllowAny]) # 允許任何請求訪問，因為這是登入/註冊流程的一部分
# def social_auth_view(request):
#     """
#     處理來自前端的社交媒體登入請求 (Google, etc.)
#     """
#     email = request.data.get('email')
#     full_name = request.data.get('full_name')

#     if not email:
#         return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

#     # 使用 get_or_create 查找或建立使用者
#     # defaults 參數只會在建立新物件時生效
#     user, created = User.objects.get_or_create(
#         email=email,
#         defaults={
#             'username': email.split('@')[0], # 使用 email 前綴作為預設 username
#             'first_name': full_name.split(' ')[0] if full_name else '',
#         }
#     )

#     if created:
#         # 如果是新建立的使用者，設定一個不可用的密碼
#         user.set_unusable_password()
#         user.save()

#     # 為使用者產生 JWT tokens
#     refresh = RefreshToken.for_user(user)

#     # 準備回傳給前端的資料
#     user_data = UserSerializer(user).data
    
#     return Response({
#         'user': user_data,
#         'access_token': str(refresh.access_token),
#         'refresh_token': str(refresh),
#     }, status=status.HTTP_200_OK)

class CustomConfirmEmailView(ConfirmEmailView):
    def get(self, request, *args, **kwargs):
        key = kwargs.get('key')
        logger.info(f"Attempting to confirm email with key: {key}")
        
        # 從環境變數獲取前端 URL
        frontend_base_url = os.getenv('FRONTEND_BASE_URL', 'http://localhost:3000')
        frontend_success_url = f"{frontend_base_url}/email-confirmed?status=success"
        frontend_error_url = f"{frontend_base_url}/email-confirmed?status=error"
        
        try:
            email_confirmation = EmailConfirmation.objects.get(key=key)
            logger.info(f"Found email confirmation for: {email_confirmation.email_address.email}")
            
            # 檢查是否過期
            if email_confirmation.key_expired():
                logger.error("Email confirmation key has expired!")
                return redirect(f"{frontend_error_url}&reason=expired")
            
            # 確認 email
            email_confirmation.confirm(request)
            logger.info("Email confirmation successful!")
            
            # 重定向到前端成功頁面
            return redirect(frontend_success_url)
                
        except EmailConfirmation.DoesNotExist:
            logger.error(f"No email confirmation found for key: {key}")
            return redirect(f"{frontend_error_url}&reason=invalid_key")
        except Exception as e:
            logger.error(f"Error during email confirmation: {str(e)}")
            return redirect(f"{frontend_error_url}&reason=server_error")
    
    def post(self, request, *args, **kwargs):
        return self.get(request, *args, **kwargs)

class RegisterView(APIView):
    def cpost(self, request):
        print("-----start-----")
        print("request.data: ",request.data)
        username = request.data.get("username")
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        email = request.data.get("email")
        password1 = request.data.get("password1")
        password2 = request.data.get("password2")

        if User.objects.filter(email=email).exists():
            return Response({"detail": "Email already in use."}, status=400)
        
        if password1 != password2:
            return Response({"detail": "Passwords do not match."}, status=400)

        user = User.objects.create_user(username=username, email=email, password=password1, first_name=first_name, last_name=last_name)
        return Response({"detail": "User created successfully."}, status=201)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated] 

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return Response({"error": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out"}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({"error": "Token Unvalid"}, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated] 

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    # callback_url 不需要在此處設定，因為我們是從客戶端直接發送 token
    client_class = OAuth2Client

