# apps/dashboard/views.py 或 apps/api/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated

# 假設這些是您其他 apps 的 models 或 serializers
from apps.clients.models import Client, ClientSetting
from apps.connections.models import Connection
from apps.queries.models import QueryDefinition
from apps.connections.models import ConnectionExecution # 假設您有這個模型
from apps.queries.models import QueryRunResult # 假設您有這個模型

# 假設您有對應的序列化器
from apps.clients.serializers import ClientSerializer
from apps.connections.serializers import ConnectionSerializer
from apps.queries.serializers import QueryDefinitionSerializer
from apps.connections.serializers import ConnectionExecutionSerializer
from apps.queries.serializers import QueryRunResultSerializer


class DashboardDataAPIView(APIView):

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        user = request.user

        client_settings = ClientSetting.objects.filter(user=user)
        accessible_client_ids = client_settings.values_list('client__id', flat=True)
        # 從各個 app 獲取資料
        clients = Client.objects.filter(id__in=accessible_client_ids)
        clients_data = ClientSerializer(clients, many=True).data

        accessible_bigquery_dataset_ids = clients.values_list('bigquery_dataset_id', flat=True)

        connections = Connection.objects.filter(client__id__in=accessible_client_ids)
        connections_data = ConnectionSerializer(connections, many=True).data

        accessible_connection_ids = connections.values_list('id', flat=True)

        recent_connection_executions = ConnectionExecution.objects.filter(
            connection__id__in=accessible_connection_ids
        ).order_by('-started_at')[:10]
        recent_connection_executions_data = ConnectionExecutionSerializer(recent_connection_executions, many=True).data

        queries = QueryDefinition.objects.filter(
            bigquery_project_id__in=accessible_bigquery_dataset_ids # bigquery_project_id 實際上應該是 bigquery_dataset_id
        )
        queries_data = QueryDefinitionSerializer(queries, many=True).data

        accessible_query_ids = queries.values_list('id', flat=True)

        recent_query_executions = QueryRunResult.objects.filter(
            query__id__in=accessible_query_ids
        ).order_by('-executed_at')[:10]
        recent_query_executions_data = QueryRunResultSerializer(recent_query_executions, many=True).data
        
        dashboard_data = {
            'clients': clients_data,
            'connections': connections_data,
            'queries': queries_data,
            'recentConnectionExecutions': recent_connection_executions_data,
            'recentQueryExecutions': recent_query_executions_data,
        }

        return Response(dashboard_data, status=status.HTTP_200_OK)