# backend/apps/users/urls.py
from django.urls import path, include
from django.contrib.auth import views as auth_views
from . import views
import os

app_name = 'users'

NEXTJS_APP_URL = os.environ.get('FRONTEND_BASE_URL')

urlpatterns = [
    path('', include('dj_rest_auth.urls')),
    # 社交媒體登入 (Google)，指向我們的 API view
    path('social-auth/', views.social_auth_view, name='social-auth'),

    path('register/verify-email/<str:key>/', 
         views.CustomConfirmEmailView.as_view(),
         name='account_confirm_email'),
    # path('register/', views.RegisterView.as_view(), name='register'),
    path('register/', include('dj_rest_auth.registration.urls')),

    
        
    # path('register/verify-email/', views.VerifyEmailView.as_view(), name='verify_email'),

    # 登出 API，指向我們稍後會建立的 LogoutView
    # path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # 使用者個人資料 API，指向我們稍後會建立的 UserProfileView
    path('profile/', views.UserProfileView.as_view(), name='profile'),

    # path('password_reset/', 
    #      auth_views.PasswordResetView.as_view(
    #          template_name='users/password_reset_form.html',
    #          email_template_name='users/password_reset_email.html',
    #          subject_template_name='users/password_reset_subject.txt',
    #          success_url=reverse_lazy('users:password_reset_done')
    #      ),
    #      name='password_reset'),

    # path('password_reset/done/',
    #      auth_views.PasswordResetDoneView.as_view(
    #          template_name='users/password_reset_done.html'
    #      ),
    #      name='password_reset_done'),
    # path('reset/<uidb64>/<token>/',
    #      auth_views.PasswordResetConfirmView.as_view(
    #          template_name='users/password_reset_confirm.html',
    #          success_url=reverse_lazy('users:password_reset_complete')
    #      ),
    #      name='password_reset_confirm'),
    # path('reset/done/',
    #      auth_views.PasswordResetCompleteView.as_view(
    #          template_name='users/password_reset_complete.html'
    #      ),
    #      name='password_reset_complete'),
    # path('password_change/', auth_views.PasswordChangeView.as_view(template_name='users/password_change.html'), name='password_change'),
    # path('password_change/done/', auth_views.PasswordChangeDoneView.as_view(template_name='users/password_change_done.html'), name='password_change_done'),
    # path('profile/', views.profile, name='profile'),

    # path('api/status/', views.check_user_status, name='api-status'),
] 