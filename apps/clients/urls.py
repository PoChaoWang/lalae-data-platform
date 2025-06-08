from django.urls import path
from . import views

app_name = 'clients'

urlpatterns = [
    path('', views.ClientListView.as_view(), name='client-list'),
    path('new/', views.ClientCreateView.as_view(), name='client-create'),
    path('<uuid:pk>/edit/', views.ClientUpdateView.as_view(), name='client-update'),
    path('<uuid:pk>/delete/', views.ClientDeleteView.as_view(), name='client-delete'),
] 