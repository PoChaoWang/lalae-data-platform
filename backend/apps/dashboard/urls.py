from django.urls import path
from .views import DashboardDataAPIView

app_name = 'dashboard'

urlpatterns = [
    path('', DashboardDataAPIView.as_view(), name='dashboard-data'),
] 