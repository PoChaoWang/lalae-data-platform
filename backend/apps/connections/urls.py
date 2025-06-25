# backend/apps/connections/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views  # 假設您的視圖都在 connections/views.py 中
from .views import GoogleOAuth2CustomCallbackView

router = DefaultRouter()
# router.register(r'connections', views.ConnectionViewSet, basename='connection')
# router.register(r'clients', views.ClientViewSet, basename='connection-client')
router.register(
    r"datasources", views.DataSourceViewSet, basename="connection-datasource"
)
router.register(r"", views.ConnectionViewSet, basename="connection")

app_name = "connections"  # 為 URL 名稱加上命名空間，方便在模板中引用

urlpatterns = [
    # For Frontend
    path(
        "google-ads-resources/",
        views.get_google_ads_resources,
        name="get_google_ads_resources",
    ),
    path(
        "facebook-ad-accounts/",
        views.get_facebook_ad_accounts,
        name="get_facebook_ad_accounts",
    ),
    path(
        "facebook-all-fields/",
        views.get_facebook_all_fields,
        name="get_facebook_all_fields",
    ),
    path(
        "get-compatible-google-ads-fields/",
        views.get_compatible_google_ads_fields_api,
        name="get_compatible_google_ads_fields",
    ),
    # For Frontend and Backend
    path(
        "oauth/authorize/<uuid:client_id>/",
        views.client_oauth_authorize,
        name="client_oauth_authorize",
    ),
    path("oauth/callback/", views.oauth_callback, name="oauth_callback"),
    path(
        "accounts/google/login/callback/",
        GoogleOAuth2CustomCallbackView.as_view(),
        name="google_callback",
    ),
    path(
        "facebook/oauth/callback/",
        views.facebook_oauth_callback,
        name="facebook_oauth_callback",
    ),
    path("", include(router.urls)),
    path(
        "<uuid:client_id>/social_accounts/",
        views.get_client_social_accounts,
        name="get_client_social_accounts",
    ),
    path(
        "check-auth-status/", views.check_auth_status, name="check_auth_status"
    ),  # 修改後的通用 auth status
    # # For Backend
    # path("", views.ConnectionListView.as_view(), name="connection_list"),
    # path("select-client/", views.SelectClientView.as_view(), name="select_dataset"),
    # path(
    #     "select-source/",
    #     views.SelectDataSourceView.as_view(),
    #     name="select_data_source",
    # ),
    # path(
    #     "client/<uuid:client_id>/create/<str:source_name>/",
    #     views.ConnectionCreateView.as_view(),
    #     name="connection_create",
    # ),
    # path("<int:pk>/", views.ConnectionDetailView.as_view(), name="connection_detail"),
    # path(
    #     "<int:pk>/update/",
    #     views.ConnectionUpdateView.as_view(),
    #     name="connection_update",
    # ),
    # path('<int:pk>/clone/', views.ConnectionCloneView.as_view(), name='connection_clone'),
    # path(
    #     "<int:pk>/delete/",
    #     views.ConnectionDeleteView.as_view(),
    #     name="connection_delete",
    # ),
    # path('save-oauth-redirect/', views.save_oauth_redirect, name='save_oauth_redirect'),
    # path(
    #     "<int:pk>/oauth/reauthorize/",
    #     views.reauthorize_connection,
    #     name="reauthorize_connection",
    # ),
]
