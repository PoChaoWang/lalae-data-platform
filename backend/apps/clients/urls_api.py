# backend/apps/clients/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'clients'

router = DefaultRouter()
router.register(r'clients', views.ClientViewSet, basename='client-api')

urlpatterns = [
    path('', views.ClientListView.as_view(), name='client-list'),
    path('new/', views.ClientCreateView.as_view(), name='client-create'),
    path('<uuid:pk>/edit/', views.ClientDetailView.as_view(), name='client-update'),
    path('<uuid:pk>/delete/', views.ClientDeleteView.as_view(), name='client-delete'),

    path('api/', include(router.urls)),
] 