# main/urls.py

from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView, RedirectView
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('', views.home, name='home'),
    path('about/', views.about, name='about'),
    path('users/', include('apps.users.urls', namespace='users')),
    path('clients/', include('apps.clients.urls')),
    path('dashboard/', include('apps.dashboard.urls')),
    path('queries/', include('apps.queries.urls', namespace='queries')),
    path('connections/', include('apps.connections.urls', namespace='connections')),
]
