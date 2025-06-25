# main/urls.py

from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from . import views
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView, 
)

def email_confirm_redirect(request, key):
    try:
        from allauth.account.models import EmailConfirmation, EmailAddress
        
        print(f"Attempting to confirm email with key: {key}")
        
        # 獲取確認對象
        email_confirmation = EmailConfirmation.objects.get(key=key)
        print(f"Found email confirmation for: {email_confirmation.email_address.email}")
        
        
        # 檢查是否確認成功
        email_address = email_confirmation.email_address
        email_address.refresh_from_db()
        print(f"Email verified status: {email_address.verified}")
        
        if email_address.verified:
            print("Email confirmation successful!")
            return redirect('https://lalae-data-platform-dcvkvp9xs-pochaowangs-projects.vercel.app//email-confirmed?status=success')
        else:
            print("Email confirmation failed!")
            return redirect('https://lalae-data-platform-dcvkvp9xs-pochaowangs-projects.vercel.app//email-confirmed?status=error')
        
    except EmailConfirmation.DoesNotExist:
        print(f"EmailConfirmation with key {key} does not exist")
        return redirect('https://lalae-data-platform-dcvkvp9xs-pochaowangs-projects.vercel.app//email-confirmed?status=error')
    except Exception as e:
        print(f"Email confirmation error: {e}")
        return redirect('https://lalae-data-platform-dcvkvp9xs-pochaowangs-projects.vercel.app//email-confirmed?status=error')
    

urlpatterns = [
    path('auth/register/account-confirm-email/<str:key>/', 
         email_confirm_redirect, 
         name='account_confirm_email'),

    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # path('', views.home, name='home'),
    path('about/', views.about, name='about'),
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    # 1. 統一的驗證入口 (dj-rest-auth)
    path('auth/', include('apps.users.urls')),
    # path('auth/registration/', include('dj_rest_auth.registration.urls')),
    # 2. 各個 App 的專屬 API 入口
    # path('users/', include('apps.users.urls', namespace='users')),
    path('clients/', include('apps.clients.urls', namespace='clients')),
    path('dashboard/', include('apps.dashboard.urls', namespace='dashboard')),
    path('queries/', include('apps.queries.urls', namespace='queries')),
    path('connections/', include('apps.connections.urls', namespace='connections')),

    # Old
    # path('api/users/', include('apps.users.urls')),
    # path('api/clients/', include('apps.clients.urls')),
    # path('api/connections/', include('apps.connections.urls')),
    # path('api/queries/', include('apps.queries.urls')),
    # path('api/dashboard/', include('apps.dashboard.urls')),
    # path('api/auth/', include('dj_rest_auth.urls')),
   
]
