# backend/apps/clients/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'clients'

# -- API Router --
router = DefaultRouter()
router.register(r'', views.ClientViewSet, basename='client')


urlpatterns = [
    # --- API Path ---
    path('', include(router.urls)),

    
    # path('', views.ClientListView.as_view(), name='client-list'),
    # path('new/', views.ClientCreateView.as_view(), name='client-create'),
    # path('<uuid:pk>/edit/', views.ClientDetailView.as_view(), name='client-update'),
    # path('<uuid:pk>/delete/', views.ClientDeleteView.as_view(), name='client-delete'),
] 