from django.urls import path
from . import views  # 假設您的視圖都在 connections/views.py 中
from .views import GoogleOAuth2CustomCallbackView

app_name = "connections"  # 為 URL 名稱加上命名空間，方便在模板中引用

urlpatterns = [
    # 連接列表視圖 (渲染 connection_list.html)
    path("", views.ConnectionListView.as_view(), name="connection_list"),
    # 選擇客戶視圖 (渲染 select_dataset.html)
    path("select-client/", views.SelectClientView.as_view(), name="select_dataset"),
    # 選擇資料來源視圖 (渲染 select_data_source.html)
    path(
        "select-source/",
        views.SelectDataSourceView.as_view(),
        name="select_data_source",
    ),
    # 建立連接視圖 (渲染特定來源的 connection_form_*.html)
    # <str:source_name> 會將 URL 中的來源名稱字串傳遞給視圖
    # 例如：connections/create/GOOGLE_ADS/
    path(
        "client/<uuid:client_id>/create/<str:source_name>/",
        views.ConnectionCreateView.as_view(),
        name="connection_create",
    ),
    # 連接詳情視圖 (渲染 connection_detail.html)
    # <int:pk> 會將連接的主鍵傳遞給視圖
    path("<int:pk>/", views.ConnectionDetailView.as_view(), name="connection_detail"),
    # 更新連接視圖 (模板中被註解，但可預留 URL 結構)
    path(
        "<int:pk>/update/",
        views.ConnectionUpdateView.as_view(),
        name="connection_update",
    ),
    path('<int:pk>/clone/', views.ConnectionCloneView.as_view(), name='connection_clone'),
    # 刪除連接視圖 (渲染 connection_confirm_delete.html)
    path(
        "<int:pk>/delete/",
        views.ConnectionDeleteView.as_view(),
        name="connection_delete",
    ),
    # OAuth 相關視圖
    path('save-oauth-redirect/', views.save_oauth_redirect, name='save_oauth_redirect'),
    path('oauth/authorize/<uuid:client_id>/', views.client_oauth_authorize, name='client_oauth_authorize'),
    path('oauth/callback/', views.oauth_callback, name='oauth_callback'),
    path('facebook/oauth/callback/', views.facebook_oauth_callback, name='facebook_oauth_callback'),
    # 其他功能視圖
    # path("<int:pk>/test/", views.test_connection, name="test_connection"),
    path(
        "<int:pk>/oauth/reauthorize/",
        views.reauthorize_connection,
        name="reauthorize_connection",
    ),
    # path("<int:pk>/dts-config/", views.DTSConfigView.as_view(), name="dts_config_edit"),
    path("check-auth-status/", views.check_auth_status, name="check_auth_status"),
    path(
        "accounts/google/login/callback/",
        GoogleOAuth2CustomCallbackView.as_view(),
        name="google_callback",
    ),
]
