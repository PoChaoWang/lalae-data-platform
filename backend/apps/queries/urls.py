from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

router.register(r'', views.QueryDefinitionViewSet, basename='query')

app_name = 'queries' # 命名空間

urlpatterns = [
    # 獨立的 API 視圖函數，現在它們也直接在 /queries/ 下
    path('switch-dataset/', views.api_switch_dataset, name='api_switch_dataset'),
    path('dataset-tables/', views.api_get_dataset_tables, name='api-get-dataset-tables'), 
    path('test-query/', views.api_test_query, name='api-test-query'),
    path('run-query/', views.api_run_query, name='api-run-query'), 
    path('check-query-name/', views.api_check_query_name, name='api-check-query-name'),
    path('save-draft/', views.api_save_draft, name='api-save-draft'),
    path('delete/<int:pk>/', views.api_delete_query, name='api-delete-query'),
    path('', include(router.urls)), 
    ]
    # path('', views.QueryDefinitionListView.as_view(), name='query-list'),
    # path('dataset-select/', views.DatasetSelectView.as_view(), name='dataset-select'),
    # path('create/', views.QueryDefinitionCreateView.as_view(), name='query-create'),
    # path('<int:pk>/', views.QueryDefinitionDetailView.as_view(), name='query-detail'),
    # path('<int:pk>/edit/', views.QueryDefinitionUpdateView.as_view(), name='query-edit'),
    # path('<int:pk>/delete/', views.QueryDefinitionDeleteView.as_view(), name='query-delete'),
    # path('<int:pk>/test/', views.TestQueryView.as_view(), name='query-test'),
    # path('<int:pk>/run/', views.RunQueryView.as_view(), name='query-run'),
    # path('result/<int:result_id>/download/', views.download_query_result, name='download-result'),
    # path('switch-dataset/', views.switch_dataset, name='switch-dataset'),
    # path('test-query/', views.test_query, name='test-query'),
    # path('run-query/', views.run_query, name='run-query'),
    # path('save-query/', views.save_query, name='save-query'),
    # path('save-query/<int:pk>/', views.save_query, name='save-query-update'),
    # path('check-query-name/', views.check_query_name, name='check-query-name'),
    # path('<int:pk>/rerun/', views.rerun_query, name='rerun-query'),
    # path('<int:pk>/executions/', views.get_query_executions, name='get-query-executions'),
    # path('get-dataset-tables/', views.get_dataset_tables, name='get-dataset-tables'),
# ]