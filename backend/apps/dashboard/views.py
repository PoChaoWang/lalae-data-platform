# apps/dashboard/views.py 或 apps/api/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated

# 假設這些是您其他 apps 的 models 或 serializers
from apps.clients.models import Client
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
        # 從各個 app 獲取資料
        clients = Client.objects.all()
        connections = Connection.objects.all()
        queries = QueryDefinition.objects.all()
        recent_connection_executions = ConnectionExecution.objects.order_by('-started_at')[:10] # 取最新10條
        recent_query_executions = QueryRunResult.objects.order_by('-executed_at')[:10] # 取最新10條

        # 序列化資料
        clients_data = ClientSerializer(clients, many=True).data
        connections_data = ConnectionSerializer(connections, many=True).data
        queries_data = QueryDefinitionSerializer(queries, many=True).data
        recent_connection_executions_data = ConnectionExecutionSerializer(recent_connection_executions, many=True).data
        recent_query_executions_data = QueryRunResultSerializer(recent_query_executions, many=True).data


        # 組合所有資料
        dashboard_data = {
            'clients': clients_data,
            'connections': connections_data,
            'queries': queries_data,
            'recentConnectionExecutions': recent_connection_executions_data,
            'recentQueryExecutions': recent_query_executions_data,
        }

        return Response(dashboard_data, status=status.HTTP_200_OK)