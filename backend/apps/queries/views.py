# from django.shortcuts import render, get_object_or_404, redirect
# from django.urls import reverse_lazy
# from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView, View
# from django.contrib.auth.mixins import LoginRequiredMixin # 如果需要登入
from django.http import HttpResponse, JsonResponse, Http404
from django.utils import timezone

# from django.views.decorators.http import require_POST, require_http_methods
# from django.utils.decorators import method_decorator
from .models import QueryDefinition, QueryExecution, QueryRunResult

# from .forms import QueryDefinitionForm
from google.cloud import bigquery
from google.api_core import exceptions
from apps.clients.models import (
    Client,
    ClientSetting,
)  # 添加這行來導入 Client 和 ClientSetting 模型
from io import StringIO
from datetime import timedelta
import json
import csv

# from django.contrib.auth.decorators import login_required
# from .tasks import test_bigquery_query
from django.contrib import messages

from rest_framework import viewsets, status, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from .serializers import QueryDefinitionSerializer, QueryRunResultSerializer
from apps.clients.serializers import ClientSerializer
from rest_framework.decorators import (
    api_view,
    permission_classes,
    authentication_classes,
)
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from .tasks import run_bigquery_query_task
from django_celery_beat.models import PeriodicTask, CrontabSchedule
from django.db import transaction
from django.conf import settings
import hashlib
import re


# ------------ Here is for Next.js ------------
def get_bigquery_tables_and_columns(dataset_id):
    client = bigquery.Client()
    dataset_ref = client.dataset(dataset_id)

    try:
        # 验证数据集是否存在于 BigQuery
        client.get_dataset(dataset_ref)
    except exceptions.NotFound:
        raise Http404(f"Dataset '{dataset_id}' not found in BigQuery.")
    except Exception as e:
        raise Exception(f"Error accessing dataset '{dataset_id}': {str(e)}")

    tables_info = []
    try:
        for table in client.list_tables(dataset_ref):
            table_ref = dataset_ref.table(table.table_id)
            table_obj = client.get_table(table_ref)

            columns = []
            for field in table_obj.schema:
                columns.append({"name": field.name, "type": field.field_type})

            tables_info.append({"name": table.table_id, "columns": columns})

        return tables_info
    except Exception as e:
        print(f"Error getting tables from BigQuery: {e}")
        raise Exception(f"Error getting tables from BigQuery: {str(e)}")





def _generate_sql_hash(sql_query):
    """Generates a SHA256 hash for a given SQL query string."""
    return hashlib.sha256(sql_query.encode("utf-8")).hexdigest()


def hash_sql_query(sql):
    return hashlib.sha256(sql.encode("utf-8")).hexdigest()


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10  # 每頁 10 筆
    page_size_query_param = "page_size"  # 允許客戶端通過 'page_size' 參數指定每頁大小
    max_page_size = 100


class QueryDefinitionViewSet(viewsets.ModelViewSet):
    serializer_class = QueryDefinitionSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        queryset = QueryDefinition.objects.all()

        selected_dataset_id = self.request.query_params.get("dataset_id")

        if selected_dataset_id:
            has_permission = ClientSetting.objects.filter(
                user=user,
                client__bigquery_dataset_id=selected_dataset_id,
                client__is_active=True,
            ).exists()

            if not has_permission and not user.is_superuser:
                return QueryDefinition.objects.none()

            queryset = queryset.filter(bigquery_dataset_id=selected_dataset_id)
        else:
            if not user.is_superuser:
                accessible_dataset_ids = ClientSetting.objects.filter(
                    user=user,
                    client__is_active=True,
                    client__bigquery_dataset_id__isnull=False,
                ).values_list("client__bigquery_dataset_id", flat=True)
                queryset = queryset.filter(
                    bigquery_dataset_id__in=list(accessible_dataset_ids)
                )

        queryset = (
            queryset.select_related("last_successful_run_result")
            .prefetch_related("run_results")
            .order_by("-created_at")
        )
        return queryset

    def list(self, request, *args, **kwargs):
        # 這是處理列表請求的方法，需要確保在這裡將 client_datasets 傳回
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response_data = self.get_paginated_response(serializer.data).data
        else:
            serializer = self.get_serializer(queryset, many=True)
            response_data = {"results": serializer.data}

        # 獲取使用者有權限的所有資料集
        user = request.user
        client_settings = ClientSetting.objects.filter(
            user=user, client__is_active=True, client__bigquery_dataset_id__isnull=False
        ).select_related("client")

        client_datasets_data = []
        current_client_name = ""
        current_access_level = ""

        # 獲取當前選中的資料集資訊
        current_dataset_id = request.query_params.get("dataset_id", "")
        if not current_dataset_id:  # 如果沒有明確選中，預設選第一個
            if client_settings.exists():
                current_dataset_id = client_settings.first().client.bigquery_dataset_id

        for setting in client_settings:
            client_datasets_data.append(
                {
                    "id": setting.client.id,
                    "name": setting.client.name,
                    "bigquery_dataset_id": setting.client.bigquery_dataset_id,
                }
            )
            if setting.client.bigquery_dataset_id == current_dataset_id:
                current_client_name = setting.client.name
                current_access_level = "Owner" if setting.is_owner else "Viewer"

        response_data["current_dataset"] = current_dataset_id
        response_data["client_datasets"] = client_datasets_data
        response_data["current_client_name"] = current_client_name
        response_data["current_access_level"] = current_access_level

        return Response(response_data)

    def perform_create(self, serializer):
        dataset_id = self.request.data.get("bigquery_dataset_id")
        if not dataset_id:
            raise serializers.ValidationError(
                {"bigquery_dataset_id": "Dataset ID is required."}
            )

        user = self.request.user
        has_permission = ClientSetting.objects.filter(
            user=user,
            client__bigquery_dataset_id=dataset_id,
            client__is_active=True,
            is_owner=True,
        ).exists()

        if not has_permission and not user.is_superuser:
            raise serializers.ValidationError(
                {
                    "detail": "You do not have permission to create queries in this dataset."
                }
            )
        
        try:
            # 找到與 dataset_id 相關聯的 Client
            client_obj = Client.objects.get(bigquery_dataset_id=dataset_id)
            bigquery_project_id = client_obj.bigquery_project_id # 假設 Client 模型有這個欄位
        except Client.DoesNotExist:
            raise serializers.ValidationError(
                {"bigquery_dataset_id": "Associated BigQuery project not found for this dataset."}
            )
        
        # 提取 output 相關的設定並儲存為 JSON
        output_target = self.request.data.get("output_target", "None")
        output_config = {}
        if output_target == "GOOGLE_SHEET":
            output_config = {
                "sheet_id": self.request.data.get("sheetId"),
                "tab_name": self.request.data.get("tabName"),
                "append_mode": self.request.data.get("appendMode", False),
            }
        elif output_target == "LOOKER_STUDIO":
            output_config = {
                "email": self.request.data.get("email"),
                # 在 Looker Studio 的情況下，可能需要更多配置，例如目標表名
            }
        
        # 保存到 QueryDefinition
        serializer.save(
            owner=user,
            bigquery_dataset_id=dataset_id,
            bigquery_project_id=bigquery_project_id,
            last_run_status="PENDING",
            output_target=output_target,
            output_config=json.dumps(output_config) if output_config else None,
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if instance.owner != user and not user.is_superuser:
            raise serializers.ValidationError(
                {"detail": "You do not have permission to update this query."}
            )

        new_dataset_id = self.request.data.get(
            "bigquery_dataset_id", instance.bigquery_dataset_id
        )

        new_bigquery_project_id = instance.bigquery_project_id
        
        if new_dataset_id != instance.bigquery_dataset_id:
            has_permission = ClientSetting.objects.filter(
                user=user,
                client__bigquery_dataset_id=new_dataset_id,
                client__is_active=True,
                is_owner=True,
            ).exists()
            if not has_permission and not user.is_superuser:
                raise serializers.ValidationError(
                    {"detail": "You do not have permission to change to this dataset."}
                )
            try:
                client_obj = Client.objects.get(bigquery_dataset_id=new_dataset_id)
                new_bigquery_project_id = client_obj.bigquery_project_id
            except Client.DoesNotExist:
                raise serializers.ValidationError(
                    {"bigquery_dataset_id": "Associated BigQuery project not found for the new dataset."}
                )
        
        # 提取 output 相關的設定並儲存為 JSON
        output_target = self.request.data.get("output_target", instance.output_target)
        output_config = {}
        if output_target == "Google Sheets":
            output_config = {
                "sheet_id": self.request.data.get("sheetId"),
                "tab_name": self.request.data.get("tabName"),
                "append_mode": self.request.data.get("appendMode", False),
            }
        elif output_target == "Google Looker Studio":
            output_config = {
                "email": self.request.data.get("email"),
                # 在 Looker Studio 的情況下，可能需要更多配置，例如目標表名
            }
        
        # 保存到 QueryDefinition
        serializer.save(
            last_run_status="PENDING",
            bigquery_project_id=new_bigquery_project_id,
            output_target=output_target,
            output_config=json.dumps(output_config) if output_config else None,
        )

    @action(detail=True, methods=["get"], url_path="executions")
    def executions(self, request, pk=None):
        query_def = self.get_object()
        user = request.user

        has_permission_to_view = (
            query_def.owner == user
            or user.is_superuser
            or ClientSetting.objects.filter(
                user=user,
                client__bigquery_dataset_id=query_def.bigquery_dataset_id,
                client__is_active=True,
            ).exists()
        )
        if not has_permission_to_view:
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to view executions for this query.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        executions = query_def.run_results.all().order_by("-executed_at")[:10]
        serializer = QueryRunResultSerializer(executions, many=True)

        return Response({"status": "success", "executions": serializer.data})

    @action(
        detail=True, methods=["get"], url_path="download-result/(?P<result_pk>[^/.]+)"
    )
    def download_result(self, request, pk=None, result_pk=None):
        query_def = self.get_object()  # Ensures query exists
        user = request.user

        # 权限检查：确保用户有权访问该 query def
        has_permission_to_view = (
            query_def.owner == user
            or user.is_superuser
            or ClientSetting.objects.filter(
                user=user,
                client__bigquery_dataset_id=query_def.bigquery_dataset_id,
                client__is_active=True,
            ).exists()
        )
        if not has_permission_to_view:
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to download results for this query.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            result = QueryRunResult.objects.get(pk=result_pk, query=query_def)

            if not result.result_data_csv:
                return Response(
                    {"error": "No result data available"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if result.executed_at < timezone.now() - timedelta(days=30):
                return Response(
                    {"error": "Result has expired"}, status=status.HTTP_404_NOT_FOUND
                )

            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = (
                f'attachment; filename="query_result_{result.query.name}_{result.executed_at.strftime("%Y%m%d_%H%M%S")}.csv"'
            )

            response.write(result.result_data_csv)
            return response

        except QueryRunResult.DoesNotExist:
            return Response(
                {"error": "Result not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def api_get_dataset_tables(request):
    """
    API endpoint to get list of tables and their columns from a BigQuery dataset.
    Requires 'dataset_id' as a query parameter.
    """
    dataset_id = request.query_params.get("dataset_id")

    if not dataset_id:
        return Response(
            {
                "status": "error",
                "message": "Dataset ID is required as a query parameter.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    # 检查用户是否有权访问这个 dataset
    has_permission = ClientSetting.objects.filter(
        user=user, client__bigquery_dataset_id=dataset_id, client__is_active=True
    ).exists()

    if not has_permission and not user.is_superuser:
        return Response(
            {
                "status": "error",
                "message": "You do not have permission to access this dataset.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        tables_info = get_bigquery_tables_and_columns(dataset_id)  # 使用新的辅助函数
        return Response({"status": "success", "tables": tables_info})
    except Http404 as e:
        return Response(
            {"status": "error", "message": str(e)}, status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"status": "error", "message": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def api_test_query(request):
    try:
        data = request.data
        sql_query = data.get("sql_query")
        dataset_id = data.get("dataset_id")

        if not sql_query:
            return Response(
                {"error": "No SQL query provided"}, status=status.HTTP_400_BAD_REQUEST
            )
        if not dataset_id:
            return Response(
                {"error": "Dataset ID is required for testing query."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        has_permission = ClientSetting.objects.filter(
            user=user, client__bigquery_dataset_id=dataset_id, client__is_active=True
        ).exists()

        if not has_permission and not user.is_superuser:
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to test queries in this dataset.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        processed_sql_query = sql_query.strip()  # 去除前後空白

        # 使用正規表達式來偵測並替換 LIMIT 子句
        # pattern 匹配 'LIMIT' (不區分大小寫), 後面可選的空白, 以及一個或多個數字
        # re.IGNORECASE 讓匹配不區分大小寫
        # re.DOTALL 讓 '.' 匹配所有字元，包括換行符，以防 LIMIT 在多行查詢中
        limit_pattern = r"\s+LIMIT\s+\d+\s*$"  # 匹配 LIMIT 數字 在行尾

        # 嘗試在查詢末尾找到 LIMIT 子句並替換它
        # re.sub(pattern, replacement, string, count=0, flags=0)
        # 這裡的 count=1 表示只替換第一個匹配項，確保即使有多個 LIMIT 也只處理最後一個
        # 但通常 LIMIT 在 SQL 中只出現一次且在查詢末尾
        modified_sql_with_limit = re.sub(
            limit_pattern, " LIMIT 5", processed_sql_query, flags=re.IGNORECASE
        )

        # 如果沒有替換發生 (即原查詢沒有 LIMIT)，則手動追加 LIMIT 5
        if modified_sql_with_limit == processed_sql_query:
            final_query_for_test = f"{processed_sql_query} LIMIT 5"
        else:
            final_query_for_test = modified_sql_with_limit

        # 接下來再處理 FROM/JOIN 替換，這樣確保 LIMIT 總是在最後且被正確處理
        modified_query = final_query_for_test.replace("FROM ", f"FROM `{dataset_id}`.")
        modified_query = modified_query.replace("JOIN ", f"JOIN `{dataset_id}`.")
        modified_query = modified_query.replace(
            "INNER JOIN ", f"INNER JOIN `{dataset_id}`."
        )
        modified_query = modified_query.replace(
            "LEFT JOIN ", f"LEFT JOIN `{dataset_id}`."
        )
        modified_query = modified_query.replace(
            "RIGHT JOIN ", f"RIGHT JOIN `{dataset_id}`."
        )
        modified_query = modified_query.replace(
            "FULL JOIN ", f"FULL JOIN `{dataset_id}`."
        )

        client = bigquery.Client()

        try:
            query_job = client.query(modified_query)  # 使用處理過的 modified_query
            results = query_job.result()

            preview_data = []
            columns = []

            # 調試信息
            # print(f"Final query sent to BigQuery: {modified_query}")
            # print(f"Query job state: {query_job.state}")
            # print(f"Query job errors: {query_job.errors}")
            # print(f"Total bytes processed: {query_job.total_bytes_processed}")
            # print(f"Results total rows: {results.total_rows}")
            # print(f"Results schema: {results.schema}")

            if results.schema:
                columns = [field.name for field in results.schema]
                # print(f"Columns: {columns}")

                row_count = 0
                for row in results:
                    row_count += 1
                    row_data = [
                        str(value) if value is not None else "NULL"
                        for value in row.values()
                    ]
                    preview_data.append(row_data)
            #         print(f"Row {row_count}: {row_data}")

            # print(f"Preview data count: {len(preview_data)}")
            # print(f"Preview data: {preview_data}")

            total_bytes = (
                query_job.total_bytes_processed
                if query_job.total_bytes_processed is not None
                else 0
            )
            total_rows_preview = len(preview_data)

            return Response(
                {
                    "status": "success",
                    "message": "Query executed for preview.",
                    "preview_data": preview_data,
                    "columns": columns,
                    "estimated_bytes_processed": total_bytes,
                    "total_rows_preview": total_rows_preview,
                    "query_executed": modified_query,
                    "has_data": len(preview_data) > 0,
                    "row_count": len(preview_data),
                }
            )

        except exceptions.BadRequest as e:
            return Response(
                {"success": False, "error_message": f"Query syntax error: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except exceptions.Forbidden as e:
            return Response(
                {"success": False, "error_message": f"Permission denied: {str(e)}"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except exceptions.NotFound as e:
            return Response(
                {"success": False, "error_message": f"Resource not found: {str(e)}"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"success": False, "error_message": f"Unexpected error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def api_save_draft(request):
    """
    API endpoint to save a query definition as a draft.
    Does not require a successful test.
    """
    print("Received request data for save_draft:", request.data) #
    try:
        data = request.data
        query_name = data.get("name", "").strip() #
        sql_query = data.get("sql_query") #
        dataset_id = data.get("bigquery_dataset_id") #

        if not query_name: #
            return Response(
                {"error": "Query name is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        if not sql_query: #
            return Response(
                {"error": "SQL query is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        if not dataset_id: #
            return Response(
                {"error": "Dataset ID is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user #
        # Check if user has permission to save to this dataset
        has_permission = ClientSetting.objects.filter(
            user=user,
            client__bigquery_dataset_id=dataset_id,
            client__is_active=True,
            is_owner=True,  # Only owners can create/save queries
        ).exists() #

        if not has_permission and not user.is_superuser: #
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to save queries in this dataset.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 處理排程類型和頻率
        schedule_frequency = data.get("schedule_frequency", "Once") #
        if schedule_frequency == "Once":
            schedule_type = "ONCE"
            cron_schedule_str = None
        else:
            schedule_type = "PERIODIC"
            schedule_hour = data.get("schedule_hour", 0) #
            schedule_minute = data.get("schedule_minute", 0) #
            cron_schedule_str = f"{schedule_minute} {schedule_hour} * * *" # 預設 Daily
            if schedule_frequency == "Weekly": #
                selected_days = data.get("schedule_days_of_week", "") # 逗號分隔的數字字串 '0,1,2'
                # cron: minute hour day_of_month month day_of_week
                # 例如：每週一、三、五的 9:30 => 30 9 * * 1,3,5
                # 注意：Cron 格式中 0=Sunday, 1=Monday...6=Saturday
                # 前端如果傳入 0-6 (Mon-Sun), 這裡要對應轉換
                # 前端傳入的 0=Mon, 1=Tue, ..., 6=Sun
                # Celery Beat 的 CrontabSchedule day_of_week 是 0=Sunday, 1=Monday, ..., 6=Saturday
                # 這裡的映射要確保正確，假設前端 0=Mon, 後端也希望從 Mon=1 開始
                # 故前端的 0(Mon) -> Cron 1, 1(Tue) -> Cron 2, ..., 6(Sun) -> Cron 0
                cron_day_mapping = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}
                parsed_days = []
                if selected_days:
                    for d_str in selected_days.split(','):
                        try:
                            # 如果前端傳入的 '0' 代表星期一，那麼在 Celery Cron 中為 '1'
                            # 如果前端傳入的 '6' 代表星期日，那麼在 Celery Cron 中為 '0'
                            parsed_days.append(str(cron_day_mapping[int(d_str)]))
                        except (ValueError, KeyError):
                            pass # 忽略無效輸入
                if parsed_days:
                    cron_schedule_str = f"{schedule_minute} {schedule_hour} * * {','.join(parsed_days)}"
                else:
                    # 如果選擇了 Weekly 但沒有選擇具體天數，則默認每天執行 (與 Daily 相似)
                    cron_schedule_str = f"{schedule_minute} {schedule_hour} * * *"

            elif schedule_frequency == "Monthly": #
                day_of_month = data.get("schedule_day_of_month", 1) #
                cron_schedule_str = f"{schedule_minute} {schedule_hour} {day_of_month} * *"

        # 提取 output 相關的設定並儲存為 JSON
        output_target_type = data.get("output_target", "NONE") #
        output_config_json = {}
        if output_target_type == "GOOGLE_SHEET": #
            output_config_json = {
                "sheet_id": data.get("sheetId", ""),
                "tab_name": data.get("tabName", ""), 
                "append_mode": data.get("appendMode", False), 
            }
        elif output_target_type == "LOOKER_STUDIO": #
            output_config_json = {
                "email": data.get("email", ""), #
            }
        # 對於 'Download' 類型，模型不需要額外的 output_config 數據，因為 CSV 將存儲在 QueryRunResult 中。

        # 使用 transaction 確保原子性操作
        with transaction.atomic():
            # Try to get existing query or create a new one
            query_def, created = QueryDefinition.objects.get_or_create(
                name=query_name,
                owner=user,
                bigquery_dataset_id=dataset_id,
                defaults={
                    "sql_query": sql_query,
                    "last_run_status": "DRAFT",  # Mark as DRAFT
                    "schedule_type": schedule_type,
                    "cron_schedule": cron_schedule_str,
                    "output_target": output_target_type,
                    "output_config": json.dumps(output_config_json) if output_config_json else None,
                },
            ) #

            if not created: #
                # Update existing query
                query_def.sql_query = sql_query
                query_def.last_run_status = (
                    "DRAFT"  # Ensure it's still a draft after update
                ) #
                # 更新排程和輸出設定
                query_def.schedule_type = schedule_type
                query_def.cron_schedule = cron_schedule_str
                query_def.output_target = output_target_type
                query_def.output_config = json.dumps(output_config_json) if output_config_json else None
                query_def.save() #

            # 如果是排程任務，更新或創建 Celery PeriodicTask
            if schedule_type == "PERIODIC" and cron_schedule_str:
                # 創建或獲取 CrontabSchedule
                schedule, _ = CrontabSchedule.objects.get_or_create(
                    minute=schedule_minute,
                    hour=schedule_hour,
                    day_of_week='*' if schedule_frequency != "Weekly" else cron_schedule_str.split()[-1], # 從cron_schedule_str提取day_of_week
                    day_of_month='*' if schedule_frequency != "Monthly" else cron_schedule_str.split()[-3], # 從cron_schedule_str提取day_of_month
                    month_of_year='*',
                )

                # 創建或更新 PeriodicTask
                task_name = f"query_definition_{query_def.id}_periodic_task"
                PeriodicTask.objects.update_or_create(
                    name=task_name,
                    defaults={
                        'task': 'queries.tasks.run_bigquery_query_task', # Celery Task 名稱
                        'crontab': schedule,
                        'args': json.dumps([query_def.id]), # 傳遞 query_def.id 給任務
                        'enabled': True, # 啟用任務
                        'one_off': False, # 非一次性任務
                        'description': f"Scheduled run for Query: {query_def.name}"
                    }
                )
            else: # 如果頻率是 "Once" 或者從 "Periodic" 改為 "Once"
                # 刪除對應的 PeriodicTask (如果存在)
                task_name = f"query_definition_{query_def.id}_periodic_task"
                PeriodicTask.objects.filter(name=task_name).delete()


        return Response(
            {
                "status": "success",
                "query_id": query_def.id,
                "message": "Query draft saved successfully!",
            },
            status=status.HTTP_200_OK,
        ) #

    except Exception as e: #
        print(f"Error in api_save_draft: {str(e)}") # 打印詳細錯誤
        return Response(
            {"status": "error", "error_message": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def api_run_query(request):
    """
    接收來自前端的請求，如果測試通過，則創建或更新 QueryDefinition，
    然後異步觸發 BigQuery 查詢執行任務。
    """
    try:
        data = request.data
        sql_query = data.get("sql_query")
        query_name = data.get("name", "").strip()
        dataset_id = data.get("bigquery_dataset_id")
        is_test_passed = data.get("is_test_passed", False)

        if not sql_query:
            return Response(
                {"error": "No SQL query provided"}, status=status.HTTP_400_BAD_REQUEST
            )
        if not query_name:
            return Response(
                {"error": "Query name is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        if not dataset_id:
            return Response(
                {"error": "Dataset ID is required for running query."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not is_test_passed:
            return Response(
                {
                    "status": "error",
                    "message": "Query must be successfully tested before execution.",
                },
                status=status.HTTP_412_PRECONDITION_FAILED,
            )

        user = request.user
        has_permission = ClientSetting.objects.filter(
            user=user,
            client__bigquery_dataset_id=dataset_id,
            client__is_active=True,
            is_owner=True,
        ).exists()

        if not has_permission and not user.is_superuser:
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to run queries in this dataset.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        current_sql_hash = _generate_sql_hash(sql_query)

        # 處理排程類型和頻率
        schedule_frequency = data.get("schedule_frequency", "Once")
        if schedule_frequency == "Once":
            schedule_type = "ONCE"
            cron_schedule_str = None
        else:
            schedule_type = "PERIODIC"
            schedule_hour = data.get("schedule_hour", 0)
            schedule_minute = data.get("schedule_minute", 0)
            cron_schedule_str = f"{schedule_minute} {schedule_hour} * * *" # 預設 Daily
            if schedule_frequency == "Weekly":
                selected_days = data.get("schedule_days_of_week", "") # 逗號分隔的數字字串 '0,1,2'
                cron_day_mapping = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0} # 前端 0=Mon, 後端 1=Mon (celery-beat cron 的 day_of_week)
                parsed_days = []
                if selected_days:
                    for d_str in selected_days.split(','):
                        try:
                            parsed_days.append(str(cron_day_mapping[int(d_str)]))
                        except (ValueError, KeyError):
                            pass
                if parsed_days:
                    cron_schedule_str = f"{schedule_minute} {schedule_hour} * * {','.join(parsed_days)}"
                else:
                    cron_schedule_str = f"{schedule_minute} {schedule_hour} * * *"
            elif schedule_frequency == "Monthly":
                day_of_month = data.get("schedule_day_of_month", 1)
                cron_schedule_str = f"{schedule_minute} {schedule_hour} {day_of_month} * *"


        # 提取 output 相關的設定並儲存為 JSON
        output_target_type = data.get("output_target", "NONE")
        output_config_json = {}
        if output_target_type == "GOOGLE_SHEET":
            output_config_json = {
                "sheet_id": data.get("sheetId", ""),
                "tab_name": data.get("tabName", ""),
                "append_mode": data.get("appendMode", False),
            }
        elif output_target_type == "LOOKER_STUDIO":
            output_config_json = {
                "email": data.get("email"),
            }

        print("output_config_json before json.dumps:", output_config_json)

        try:
            bigquery_project_id = settings.GOOGLE_CLOUD_PROJECT_ID
        except Client.DoesNotExist:
            return Response(
                {"error": "Associated BigQuery project not found for this dataset."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            print("Output config being saved:", json.dumps(output_config_json) if output_config_json else None)

            query_def, created = QueryDefinition.objects.get_or_create(
                name=query_name,
                owner=user,
                bigquery_dataset_id=dataset_id,
                defaults={
                    "sql_query": sql_query,
                    "last_run_status": "PENDING",
                    "schedule_type": schedule_type, 
                    "cron_schedule": cron_schedule_str, 
                    "output_target": output_target_type, 
                    "output_config": json.dumps(output_config_json) if output_config_json else None, 
                    "bigquery_project_id": bigquery_project_id,
                },
            )

            # 如果是更新操作，更新 SQL 內容及其他設定
            if not created:
                query_def.sql_query = sql_query
                query_def.last_run_status = "PENDING" 
                query_def.schedule_type = schedule_type
                query_def.cron_schedule = cron_schedule_str
                query_def.output_target = output_target_type
                query_def.output_config = json.dumps(output_config_json) if output_config_json else None
                query_def.bigquery_project_id = bigquery_project_id
                query_def.last_successful_test_hash = current_sql_hash
                query_def.last_tested_at = timezone.now()
                query_def.save() 

            # 確保 last_successful_test_hash 和 last_tested_at 已更新
            query_def.last_successful_test_hash = current_sql_hash
            query_def.last_tested_at = timezone.now()
            query_def.save()

            # 立即觸發一次 Celery 任務執行
            run_result = QueryRunResult.objects.create( # 創建 QueryRunResult
                query=query_def, # QueryRunResult 應該有一個指向 QueryDefinition 的外鍵
                triggered_by="MANUAL",
                status="PENDING",
                executed_at=timezone.now() # 標記為已送入佇列 (這裡應該是 executed_at)
            )
            print("Attempting to call run_bigquery_query_task.delay()")
            run_bigquery_query_task.delay(run_result.id)
            print("Called run_bigquery_query_task.delay()", run_result.id)

            # 處理 Celery 定期任務 (如果頻率不是 Once)
            if schedule_type == "PERIODIC" and cron_schedule_str:
                schedule, _ = CrontabSchedule.objects.get_or_create(
                    minute=schedule_minute,
                    hour=schedule_hour,
                    day_of_week='*' if schedule_frequency != "Weekly" else ','.join(parsed_days),
                    day_of_month='*' if schedule_frequency != "Monthly" else str(day_of_month),
                    month_of_year='*',
                )

                task_name = f"query_definition_{query_def.id}_periodic_task"
                PeriodicTask.objects.update_or_create(
                    name=task_name,
                    defaults={
                        'task': 'queries.tasks.run_bigquery_query_task',
                        'crontab': schedule,
                        'args': json.dumps([query_def.id]),
                        'enabled': True,
                        'one_off': False,
                        'description': f"Scheduled run for Query: {query_def.name}"
                    }
                )
            else: # 如果是 "Once" 或之前是排程但現在改成 "Once"
                # 禁用或刪除可能的舊的 PeriodicTask
                task_name = f"query_definition_{query_def.id}_periodic_task"
                PeriodicTask.objects.filter(name=task_name).delete() # 直接刪除，因為是 Once

        return Response(
            {
                "success": True,
                "query_id": query_def.id,
                "message": "Query saved and initiated for execution successfully.",
                "execution_id": run_result.id,
                # 您可以提供一個查詢結果的狀態頁面鏈接，讓用戶追蹤進度
                # "status_url": request.build_absolute_uri(f"/queries/{query_def.id}/executions/")
            }
        )

    except Exception as e:
        # 如果在事務中發生錯誤，所有更改會被回滾
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# 修改 api_check_query_name 函數
@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def api_check_query_name(request):
    try:
        data = request.data
        name = data.get("name", "").strip()
        dataset_id = data.get("bigquery_dataset_id")
        # 如果是編輯現有查詢，可能需要傳遞 query_id 來排除自身
        query_id = data.get("query_id")

        if not name:
            return Response(
                {"is_available": False, "error": "Query name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not dataset_id:
            return Response(
                {"is_available": False, "error": "Dataset ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = QueryDefinition.objects.filter(
            name=name, bigquery_dataset_id=dataset_id
        )
        if query_id:
            # 如果是更新操作，排除當前正在編輯的查詢本身
            queryset = queryset.exclude(id=query_id)

        exists = queryset.exists()

        return Response({"is_available": not exists})

    except Exception as e:
        return Response(
            {"is_available": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def api_switch_dataset(request):
    """API endpoint to switch the current selected dataset."""
    try:
        data = request.data
        dataset_id = data.get("dataset_id", "").strip()

        if not dataset_id:
            return Response(
                {"status": "error", "message": "Dataset ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        # 檢查使用者是否有權限訪問該資料集
        try:
            client = Client.objects.get(bigquery_dataset_id=dataset_id)
            client_setting = ClientSetting.objects.get(client=client, user=user)

            if not client.is_active:
                return Response(
                    {"status": "error", "message": "This client is no longer active."},
                    status=status.HTTP_400_BAD_REQUEST,  # 或 HTTP_403_FORBIDDEN, 看您的業務邏輯
                )

            # 驗證資料集是否存在於 BigQuery
            bq_client = bigquery.Client()
            dataset_ref = bq_client.dataset(dataset_id)
            bq_client.get_dataset(dataset_ref)

            # 如果切換成功，這裡可以更新某種用戶設定或返回成功訊息
            # 注意：Web UI 模式下會存在 Session，但 API 模式下沒有 Session 存儲 selected_dataset
            # 如果您希望在後端持久化用戶選擇的資料集，您需要將其保存到用戶模型或一個單獨的用戶偏好模型中。
            # 目前您前端在切換後會重新 fetchQueries(1)，這會自動帶上新的 dataset_id 參數，所以可以不用後端存儲。

            return Response(
                {
                    "status": "success",
                    "message": f"Successfully switched to dataset: {dataset_id}",
                },
                status=status.HTTP_200_OK,
            )
        except Client.DoesNotExist:
            return Response(
                {"status": "error", "message": f'Dataset "{dataset_id}" not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ClientSetting.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to access this dataset.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        except exceptions.NotFound:
            return Response(
                {
                    "status": "error",
                    "message": f'Dataset "{dataset_id}" not found in BigQuery.',
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    except Exception as e:
        return Response(
            {"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST
        )

@api_view(["DELETE"])  # 僅允許 DELETE 請求
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def api_delete_query(request, pk):
    """
    API endpoint to delete a QueryDefinition.
    Requires query ID in the URL.
    """
    try:
        query_def = QueryDefinition.objects.get(pk=pk)
        user = request.user

        # 權限檢查：只有查詢的擁有者或超級使用者可以刪除
        if query_def.owner != user and not user.is_superuser:
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to delete this query.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            # 刪除 Celery PeriodicTask (如果存在)
            task_name = f"query_definition_{query_def.id}_periodic_task"
            PeriodicTask.objects.filter(name=task_name).delete()

            # 刪除 QueryDefinition
            query_def.delete()

        return Response(
            {"status": "success", "message": "Query deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,  # 成功刪除通常返回 204 No Content
        )

    except QueryDefinition.DoesNotExist:
        return Response(
            {"status": "error", "message": "Query not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        return Response(
            {"status": "error", "message": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )
# ------------ Here is for Next.js ------------


# --------------- HERE is for Backend UI ---------------
# class DatasetSelectView(LoginRequiredMixin, View):
#     template_name = 'queries/dataset_select.html'

#     def get(self, request):
#         selected_dataset = request.session.get('selected_dataset', '')
#         # 獲取使用者有權限的客戶資料集
#         client_settings = ClientSetting.objects.filter(
#             user=request.user,
#             client__is_active=True,
#             client__bigquery_dataset_id__isnull=False
#         ).select_related('client')

#         client_datasets = []
#         for setting in client_settings:
#             dataset_info = {
#                 'client_name': setting.client.name,
#                 'dataset_id': setting.client.bigquery_dataset_id,
#                 'description': f"Access Level: {'Owner' if setting.is_owner else 'Viewer'}"
#             }
#             client_datasets.append(dataset_info)

#         return render(request, self.template_name, {
#             'selected_dataset': selected_dataset,
#             'client_datasets': client_datasets
#         })

#     def post(self, request):
#         dataset_id = request.POST.get('dataset_id', '').strip()
#         if not dataset_id:
#             return render(request, self.template_name, {
#                 'error_message': 'Please enter a dataset ID',
#                 'selected_dataset': dataset_id
#             })

#         # 檢查使用者是否有權限訪問該資料集
#         try:
#             client = Client.objects.get(bigquery_dataset_id=dataset_id)
#             client_setting = ClientSetting.objects.get(client=client, user=request.user)

#             if not client.is_active:
#                 return render(request, self.template_name, {
#                     'error_message': 'This client is no longer active',
#                     'selected_dataset': dataset_id
#                 })

#             # 驗證資料集是否存在於 BigQuery
#             bq_client = bigquery.Client()
#             dataset_ref = bq_client.dataset(dataset_id)
#             bq_client.get_dataset(dataset_ref)

#             # 保存到 session
#             request.session['selected_dataset'] = dataset_id
#             return redirect('queries:query-list')
#         except Client.DoesNotExist:
#             return render(request, self.template_name, {
#                 'error_message': f'Dataset "{dataset_id}" not found',
#                 'selected_dataset': dataset_id
#             })
#         except ClientSetting.DoesNotExist:
#             return render(request, self.template_name, {
#                 'error_message': 'You do not have permission to access this dataset',
#                 'selected_dataset': dataset_id
#             })
#         except exceptions.NotFound:
#             return render(request, self.template_name, {
#                 'error_message': f'Dataset "{dataset_id}" not found in BigQuery',
#                 'selected_dataset': dataset_id
#             })
#         except Exception as e:
#             return render(request, self.template_name, {
#                 'error_message': f'Error: {str(e)}',
#                 'selected_dataset': dataset_id
#             })

# def get_dataset_tables(request):
#     """Get list of tables and their columns from BigQuery dataset."""
#     client = bigquery.Client()
#     dataset_id = request.session.get('selected_dataset')
#     if not dataset_id:
#         return []

#     dataset_ref = client.dataset(dataset_id)

#     try:
#         tables = []
#         for table in client.list_tables(dataset_ref):
#             table_ref = dataset_ref.table(table.table_id)
#             table_obj = client.get_table(table_ref)

#             columns = []
#             for field in table_obj.schema:
#                 columns.append({
#                     'name': field.name,
#                     'type': field.field_type
#                 })

#             tables.append({
#                 'name': table.table_id,
#                 'columns': columns
#             })

#         return tables
#     except Exception as e:
#         print(f"Error getting tables: {e}")
#         return []

# --- QueryDefinition CRUD ---
# class QueryDefinitionListView(LoginRequiredMixin, ListView):
#     model = QueryDefinition
#     template_name = 'queries/querydefinition_list.html'
#     context_object_name = 'queries'
#     paginate_by = 15
#     ordering = ['-last_run_initiated_at']

#     def get(self, request, *args, **kwargs):
#         if not request.session.get('selected_dataset'):
#             return redirect('queries:dataset-select')

#         # 檢查當前選擇的資料集是否仍然有權限訪問
#         try:
#             client = Client.objects.get(bigquery_dataset_id=request.session['selected_dataset'])
#             client_setting = ClientSetting.objects.get(client=client, user=request.user)
#             if not client.is_active:
#                 return redirect('queries:dataset-select')
#         except (Client.DoesNotExist, ClientSetting.DoesNotExist):
#             return redirect('queries:dataset-select')

#         return super().get(request, *args, **kwargs)

#     def get_context_data(self, **kwargs):
#         context = super().get_context_data(**kwargs)
#         # 獲取使用者有權限的客戶資料集
#         client_settings = ClientSetting.objects.filter(
#             user=self.request.user,
#             client__is_active=True
#         ).select_related('client')

#         client_datasets = []
#         for setting in client_settings:
#             if setting.client.bigquery_dataset_id:  # 確保有資料集 ID
#                 dataset_info = {
#                     'client_name': setting.client.name,
#                     'dataset_id': setting.client.bigquery_dataset_id,
#                     'description': f"Access Level: {'Owner' if setting.is_owner else 'Viewer'}"
#                 }
#                 client_datasets.append(dataset_info)

#         context['client_datasets'] = client_datasets
#         context['current_dataset'] = self.request.session.get('selected_dataset', '')

#         # 獲取當前資料集的客戶資訊
#         try:
#             current_client = Client.objects.get(bigquery_dataset_id=context['current_dataset'])
#             current_setting = ClientSetting.objects.get(client=current_client, user=self.request.user)
#             context['current_client_name'] = current_client.name
#             context['current_access_level'] = 'Owner' if current_setting.is_owner else 'Viewer'
#         except (Client.DoesNotExist, ClientSetting.DoesNotExist):
#             context['current_client_name'] = 'Unknown'
#             context['current_access_level'] = 'No Access'

#         return context

#     def get_queryset(self):
#         queryset = super().get_queryset()
#         # Filter by the selected dataset
#         dataset_id = self.request.session.get('selected_dataset')
#         if dataset_id:
#             queryset = queryset.filter(bigquery_dataset_id=dataset_id)

#         # Add execution status information
#         for query in queryset:
#             latest_result = query.run_results.first()
#             if latest_result:
#                 query._latest_status = latest_result.status
#                 query._latest_execution_time = latest_result.executed_at
#                 query._has_downloadable_result = (
#                     latest_result.status in ['SUCCESS', 'OUTPUT_ERROR'] and
#                     latest_result.result_data_csv and
#                     latest_result.executed_at > timezone.now() - timedelta(days=30)
#                 )
#             else:
#                 query._latest_status = 'PENDING'
#                 query._latest_execution_time = None
#                 query._has_downloadable_result = False
#         return queryset

# class QueryDefinitionDetailView(LoginRequiredMixin, DetailView):
#     model = QueryDefinition
#     template_name = 'queries/querydefinition_detail.html'
#     context_object_name = 'query_def'

#     def get_context_data(self, **kwargs):
#         context = super().get_context_data(**kwargs)
#         context['executions'] = self.object.executions.all().order_by('-started_at')[:20]
#         return context

# class QueryDefinitionCreateView(LoginRequiredMixin, CreateView):
#     model = QueryDefinition
#     form_class = QueryDefinitionForm
#     template_name = 'queries/querydefinition_form.html'
#     success_url = reverse_lazy('queries:query-list')

#     def get(self, request, *args, **kwargs):
#         if not request.session.get('selected_dataset'):
#             return redirect('queries:dataset-select')
#         return super().get(request, *args, **kwargs)

#     def get_context_data(self, **kwargs):
#         context = super().get_context_data(**kwargs)
#         context['dataset_tables'] = get_dataset_tables(self.request)
#         return context

#     def form_valid(self, form):
#         form.instance.owner = self.request.user
#         form.instance.last_run_status = 'PENDING'
#         form.instance.bigquery_dataset_id = self.request.session.get('selected_dataset')
#         return super().form_valid(form)

# class QueryDefinitionUpdateView(LoginRequiredMixin, UpdateView):
#     model = QueryDefinition
#     form_class = QueryDefinitionForm
#     template_name = 'queries/querydefinition_form.html'

#     def get(self, request, *args, **kwargs):
#         if not request.session.get('selected_dataset'):
#             return redirect('queries:dataset-select')
#         return super().get(request, *args, **kwargs)

#     def get_context_data(self, **kwargs):
#         context = super().get_context_data(**kwargs)
#         context['dataset_tables'] = get_dataset_tables(self.request)
#         return context

#     def get_success_url(self):
#         return reverse_lazy('queries:query-detail', kwargs={'pk': self.object.pk})

#     def form_valid(self, form):
#         form.instance.last_run_status = 'PENDING'
#         return super().form_valid(form)

# class QueryDefinitionDeleteView(LoginRequiredMixin, DeleteView):
#     model = QueryDefinition
#     template_name = 'queries/querydefinition_confirm_delete.html' # 需要建立此模板
#     success_url = reverse_lazy('queries:query-list')

#     # 可以加入權限檢查
#     # def get_queryset(self):
#     #     queryset = super().get_queryset()
#     #     return queryset.filter(owner=self.request.user)

# # --- 查詢執行相關 ---
# def trigger_query_execution(request, pk):
#     query_def = get_object_or_404(QueryDefinition, pk=pk)
#     # 權限檢查 (例如: 只有 owner 或特定群組可以執行)
#     # if query_def.owner != request.user and not request.user.is_staff:
#     #     return HttpResponse("Unauthorized", status=403)

#     # 建立 QueryExecution 紀錄
#     execution = QueryExecution.objects.create(
#         query_definition=query_def,
#         triggered_by='MANUAL', # 或 request.user.username
#         status='PENDING',
#         started_at=timezone.now() # 標記為已開始處理 (送入隊列)
#     )

#     # **非同步執行 BigQuery 查詢**
#     # run_bigquery_query_task.delay(execution.id) # 使用 Celery
#     # 如果是同步執行 (不建議用於可能長時間的查詢):
#     # from .bq_services import execute_and_handle_bq_query # 你需要建立這個服務函數
#     # execute_and_handle_bq_query(execution.id)


#     # 這裡只是示意，實際執行應該用 Celery task
#     # 模擬執行
#     # import time
#     # time.sleep(2) # 模擬 BigQuery 執行
#     # execution.status = 'SUCCESS'
#     # execution.completed_at = timezone.now()
#     # execution.result_message = "手動模擬執行成功。"
#     # execution.result_rows_count = 100
#     # execution.save()

#     # return redirect('queries:query-detail', pk=query_def.pk)
#     return JsonResponse({'status': 'success', 'message': f'查詢 "{query_def.name}" 已加入執行佇列。', 'execution_id': execution.id})


# def download_query_result(request, result_pk):
#     result = get_object_or_404(QueryRunResult, pk=result_pk)

#     if not result.result_data_csv:
#         raise Http404("No result data available")

#     if result.executed_at < timezone.now() - timedelta(days=30):
#         raise Http404("Result has expired")

#     response = HttpResponse(content_type='text/csv')
#     response['Content-Disposition'] = f'attachment; filename="query_result_{result.query.name}_{result.executed_at.strftime("%Y%m%d_%H%M%S")}.csv"'

#     response.write(result.result_data_csv)
#     return response

# def switch_dataset(request):
#     """切換當前選擇的資料集"""
#     if request.method == 'POST':
#         dataset_id = request.POST.get('dataset_id')
#         if dataset_id:
#             try:
#                 # 檢查使用者是否有權限訪問該資料集
#                 client = Client.objects.get(bigquery_dataset_id=dataset_id)
#                 client_setting = ClientSetting.objects.get(client=client, user=request.user)

#                 if not client.is_active:
#                     messages.error(request, 'This client is no longer active')
#                     return redirect('queries:query-list')

#                 # 驗證資料集是否存在於 BigQuery
#                 bq_client = bigquery.Client()
#                 dataset_ref = bq_client.dataset(dataset_id)
#                 bq_client.get_dataset(dataset_ref)

#                 # 保存到 session
#                 request.session['selected_dataset'] = dataset_id
#                 return redirect('queries:query-list')
#             except Client.DoesNotExist:
#                 messages.error(request, 'Dataset not found')
#                 return redirect('queries:query-list')
#             except ClientSetting.DoesNotExist:
#                 messages.error(request, 'You do not have permission to access this dataset')
#                 return redirect('queries:query-list')
#             except Exception as e:
#                 messages.error(request, str(e))
#                 return redirect('queries:query-list')
#     messages.error(request, 'Invalid request')
#     return redirect('queries:query-list')

# @method_decorator(require_POST, name='dispatch')
# class TestQueryView(LoginRequiredMixin, View):
#     def post(self, request, pk):
#         query_def = get_object_or_404(QueryDefinition, pk=pk)

#         try:
#             # Execute the query
#             client = bigquery.Client()
#             query_job = client.query(query_def.sql_query)
#             results = query_job.result()

#             # Convert to list of dicts for JSON serialization
#             rows = []
#             for row in results:
#                 rows.append(dict(row.items()))

#             # Store first 10 rows for preview
#             preview_rows = rows[:10]

#             return JsonResponse({
#                 'status': 'success',
#                 'preview_rows': preview_rows,
#                 'total_rows': len(rows),
#                 'columns': list(rows[0].keys()) if rows else []
#             })

#         except Exception as e:
#             return JsonResponse({
#                 'status': 'error',
#                 'error_message': str(e)
#             }, status=400)

# @method_decorator(require_POST, name='dispatch')
# class RunQueryView(LoginRequiredMixin, View):
#     def post(self, request, pk):
#         query_def = get_object_or_404(QueryDefinition, pk=pk)

#         # Create a new run result
#         run_result = QueryRunResult.objects.create(
#             query=query_def,
#             status='RUNNING'
#         )

#         try:
#             # Execute the query
#             client = bigquery.Client()
#             query_job = client.query(query_def.sql_query)
#             results = query_job.result()

#             # Convert to CSV
#             output = StringIO()
#             writer = csv.writer(output)

#             # Write header
#             if results:
#                 writer.writerow(results[0].keys())
#                 # Write data
#                 for row in results:
#                     writer.writerow(row.values())

#             # Store the result
#             run_result.result_data_csv = output.getvalue()
#             run_result.status = 'SUCCESS'

#             # Update query definition
#             query_def.last_run_status = 'SUCCESS'
#             query_def.last_run_initiated_at = timezone.now()
#             query_def.last_successful_run_result = run_result
#             query_def.save()

#             # Handle output target if specified
#             if query_def.output_target != 'NONE':
#                 try:
#                     self._handle_output_target(query_def, run_result)
#                 except Exception as e:
#                     run_result.status = 'OUTPUT_ERROR'
#                     run_result.error_message = f"Query succeeded but output failed: {str(e)}"
#                     run_result.save()
#                     query_def.last_run_status = 'OUTPUT_ERROR'
#                     query_def.save()

#             return JsonResponse({
#                 'status': 'success',
#                 'message': 'Query executed successfully'
#             })

#         except Exception as e:
#             run_result.status = 'FAILED'
#             run_result.error_message = str(e)
#             run_result.save()

#             query_def.last_run_status = 'FAILED'
#             query_def.save()

#             return JsonResponse({
#                 'status': 'error',
#                 'error_message': str(e)
#             }, status=400)

#     def _handle_output_target(self, query_def, run_result):
#         output_config = query_def.output_config

#         if query_def.output_target == 'GOOGLE_SHEET':
#             # Implement Google Sheet output
#             pass
#         elif query_def.output_target == 'LOOKER_STUDIO':
#             # Implement BigQuery table output for Looker Studio
#             pass

# @login_required
# @require_http_methods(["POST"])
# def test_query(request):
#     try:
#         data = json.loads(request.body)
#         sql_query = data.get('sql_query')

#         if not sql_query:
#             return JsonResponse({'error': 'No SQL query provided'}, status=400)

#         # Get the current dataset from session
#         dataset_id = request.session.get('selected_dataset')
#         if not dataset_id:
#             return JsonResponse({'error': 'No dataset selected'}, status=400)

#         # Modify the query to include dataset name
#         # This is a simple approach - you might need more sophisticated SQL parsing
#         # to handle complex queries with multiple tables
#         modified_query = sql_query.replace('FROM ', f'FROM `{dataset_id}`.')
#         modified_query = modified_query.replace('JOIN ', f'JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('INNER JOIN ', f'INNER JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('LEFT JOIN ', f'LEFT JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('RIGHT JOIN ', f'RIGHT JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('FULL JOIN ', f'FULL JOIN `{dataset_id}`.')

#         # Run the test query task
#         task = test_bigquery_query.delay(modified_query)

#         # Wait for the task to complete (with timeout)
#         try:
#             result = task.get(timeout=30)  # 30 seconds timeout
#             if result['success']:
#                 return JsonResponse({
#                     'success': True,
#                     'results': result['results']
#                 })
#             else:
#                 return JsonResponse({
#                     'error': result['error']
#                 }, status=400)
#         except Exception as e:
#             return JsonResponse({
#                 'error': f'Query execution timed out or failed: {str(e)}'
#             }, status=400)

#     except Exception as e:
#         return JsonResponse({
#             'error': str(e)
#         }, status=400)

# @login_required
# @require_http_methods(["POST"])
# def run_query(request):
#     try:
#         data = json.loads(request.body)
#         sql_query = data.get('sql_query')
#         query_name = data.get('name', '').strip()

#         if not sql_query:
#             return JsonResponse({'error': 'No SQL query provided'}, status=400)

#         if not query_name:
#             return JsonResponse({'error': 'Query name is required'}, status=400)

#         # Get the current dataset from session
#         dataset_id = request.session.get('selected_dataset')
#         if not dataset_id:
#             return JsonResponse({'error': 'No dataset selected'}, status=400)

#         # Modify the query to include dataset name
#         modified_query = sql_query.replace('FROM ', f'FROM `{dataset_id}`.')
#         modified_query = modified_query.replace('JOIN ', f'JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('INNER JOIN ', f'INNER JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('LEFT JOIN ', f'LEFT JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('RIGHT JOIN ', f'RIGHT JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('FULL JOIN ', f'FULL JOIN `{dataset_id}`.')

#         # Create a new query definition
#         query_def = QueryDefinition.objects.create(
#             name=query_name,
#             sql_query=sql_query,
#             last_run_status='RUNNING',
#             last_run_initiated_at=timezone.now(),
#             owner=request.user,
#             bigquery_dataset_id=dataset_id
#         )

#         # Create a run result
#         run_result = QueryRunResult.objects.create(
#             query=query_def,
#             status='RUNNING'
#         )

#         try:
#             # Execute the query
#             client = bigquery.Client()
#             query_job = client.query(modified_query)
#             results = query_job.result()

#             # Convert results to CSV
#             output = StringIO()
#             writer = csv.writer(output)

#             # Get the first row to get column names
#             first_row = next(iter(results), None)
#             if first_row:
#                 # Write header
#                 writer.writerow(first_row.keys())
#                 # Write first row
#                 writer.writerow(first_row.values())
#                 # Write remaining rows
#                 for row in results:
#                     writer.writerow(row.values())

#             # Store the result
#             run_result.result_data_csv = output.getvalue()
#             run_result.status = 'SUCCESS'
#             run_result.save()

#             # Update query definition
#             query_def.last_run_status = 'SUCCESS'
#             query_def.last_successful_run_result = run_result
#             query_def.save()

#             return JsonResponse({
#                 'success': True,
#                 'query_id': query_def.id,
#                 'message': 'Query executed successfully'
#             })

#         except Exception as e:
#             run_result.status = 'FAILED'
#             run_result.error_message = str(e)
#             run_result.save()

#             query_def.last_run_status = 'FAILED'
#             query_def.save()

#             return JsonResponse({
#                 'error': str(e)
#             }, status=400)

#     except Exception as e:
#         return JsonResponse({
#             'error': str(e)
#         }, status=400)

# @login_required
# @require_http_methods(["POST"])
# def save_query(request, pk=None):
#     print("save_query view called with pk:", pk) # Debug log
#     try:
#         data = json.loads(request.body)
#         print("Received data:", data) # Debug log

#         sql_query = data.get('sql_query')
#         query_name = data.get('name', '').strip()

#         if not sql_query:
#             print("No SQL query provided") # Debug log
#             return JsonResponse({'error': 'No SQL query provided'}, status=400)

#         if not query_name:
#             print("No query name provided") # Debug log
#             return JsonResponse({'error': 'Query name is required'}, status=400)

#         # Get the current dataset from session
#         dataset_id = request.session.get('selected_dataset')
#         if not dataset_id:
#             print("No dataset selected") # Debug log
#             return JsonResponse({'error': 'No dataset selected'}, status=400)

#         if pk:  # If pk is provided, update existing query
#             try:
#                 query_def = QueryDefinition.objects.get(pk=pk)
#                 # Check if user has permission to edit this query
#                 if query_def.owner != request.user:
#                     return JsonResponse({'error': 'You do not have permission to edit this query'}, status=403)

#                 print(f"Updating existing query: id={pk}") # Debug log
#                 query_def.name = query_name
#                 query_def.sql_query = sql_query
#                 query_def.last_run_status = 'PENDING'
#                 query_def.save()

#                 print(f"Query updated successfully: id={pk}") # Debug log
#                 return JsonResponse({
#                     'success': True,
#                     'query_id': query_def.id,
#                     'message': 'Query Updated Successfully'
#                 })
#             except QueryDefinition.DoesNotExist:
#                 return JsonResponse({'error': 'Query not found'}, status=404)
#         else:  # Create new query
#             print(f"Creating new query definition: name={query_name}, dataset={dataset_id}") # Debug log

#             # Create a new query definition
#             query_def = QueryDefinition.objects.create(
#                 name=query_name,
#                 sql_query=sql_query,
#                 last_run_status='PENDING',
#                 last_run_initiated_at=timezone.now(),
#                 owner=request.user,
#                 bigquery_dataset_id=dataset_id
#             )

#             print(f"Query definition created with ID: {query_def.id}") # Debug log

#             return JsonResponse({
#                 'success': True,
#                 'query_id': query_def.id,
#                 'message': 'Query Pending'
#             })
#     except Exception as e:
#         print(f"Error in save_query: {str(e)}") # Debug log
#         return JsonResponse({
#             'error': str(e)
#         }, status=400)

# @login_required
# @require_http_methods(["POST"])
# def rerun_query(request, pk):
#     try:
#         query_def = QueryDefinition.objects.get(id=pk)

#         # Get the current dataset from session
#         dataset_id = request.session.get('selected_dataset')
#         if not dataset_id:
#             return JsonResponse({'status': 'error', 'message': 'No dataset selected'}, status=400)

#         # Modify the query to include dataset name
#         # This is a simple approach - you might need more sophisticated SQL parsing
#         # to handle complex queries with multiple tables
#         sql_query = query_def.sql_query
#         modified_query = sql_query.replace('FROM ', f'FROM `{dataset_id}`.')
#         modified_query = modified_query.replace('JOIN ', f'JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('INNER JOIN ', f'INNER JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('LEFT JOIN ', f'LEFT JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('RIGHT JOIN ', f'RIGHT JOIN `{dataset_id}`.')
#         modified_query = modified_query.replace('FULL JOIN ', f'FULL JOIN `{dataset_id}`.')

#         # Create a new run result
#         run_result = QueryRunResult.objects.create(
#             query=query_def,
#             status='RUNNING'
#         )

#         # Update query status
#         query_def.last_run_status = 'RUNNING'
#         query_def.last_run_initiated_at = timezone.now()
#         query_def.save()

#         # Start the query execution in background
#         try:
#             client = bigquery.Client()
#             # Use the modified query
#             query_job = client.query(modified_query)
#             results = query_job.result()

#             # Convert results to CSV
#             csv_data = []
#             # Add header row
#             if results and results.schema:
#                  csv_data.append(','.join([field.name for field in results.schema]))
#             for row in results:
#                 csv_data.append(','.join(str(value) for value in row))

#             # Update run result
#             run_result.status = 'SUCCESS'
#             run_result.result_data_csv = '\n'.join(csv_data)
#             run_result.save()

#             # Update query definition
#             query_def.last_run_status = 'SUCCESS'
#             query_def.last_successful_run_result = run_result
#             query_def.save()

#             return JsonResponse({'status': 'success'})

#         except Exception as e:
#             run_result.status = 'FAILED'
#             run_result.error_message = str(e)
#             run_result.save()

#             query_def.last_run_status = 'FAILED'
#             query_def.save()

#             return JsonResponse({
#                 'status': 'error',
#                 'message': str(e)
#             }, status=400)

#     except QueryDefinition.DoesNotExist:
#         return JsonResponse({
#             'status': 'error',
#             'message': 'Query not found'
#         }, status=404)
#     except Exception as e:
#         return JsonResponse({
#             'status': 'error',
#             'message': str(e)
#         }, status=400)

# @login_required
# def download_query_result(request, result_id):
#     try:
#         result = QueryRunResult.objects.get(id=result_id)

#         if not result.result_data_csv:
#             return JsonResponse({'error': 'No result data available'}, status=404)

#         response = HttpResponse(result.result_data_csv, content_type='text/csv')
#         response['Content-Disposition'] = f'attachment; filename="query_result_{result.id}.csv"'
#         return response

#     except QueryRunResult.DoesNotExist:
#         return JsonResponse({'error': 'Result not found'}, status=404)
#     except Exception as e:
#         return JsonResponse({'error': str(e)}, status=400)

# @login_required
# @require_http_methods(["POST"])
# def check_query_name(request):
#     try:
#         data = json.loads(request.body)
#         name = data.get('name', '').strip()

#         if not name:
#             return JsonResponse({
#                 'is_available': False,
#                 'error': 'Query name is required'
#             }, status=400)

#         # Check if name already exists
#         exists = QueryDefinition.objects.filter(name=name).exists()

#         return JsonResponse({
#             'is_available': not exists
#         })

#     except Exception as e:
#         return JsonResponse({
#             'is_available': False,
#             'error': str(e)
#         }, status=400)

# @login_required
# @require_http_methods(["GET"])
# def get_query_executions(request, pk):
#     try:
#         query_def = get_object_or_404(QueryDefinition, pk=pk)
#         # 獲取該 QueryDefinition 關聯的最近10次 QueryRunResult 記錄
#         executions = query_def.run_results.all().order_by('-executed_at')[:10]

#         # 準備 JSON 響應數據
#         execution_list = []
#         for exec in executions:
#             execution_list.append({
#                 'id': exec.id,
#                 'executed_at': exec.executed_at.strftime('%Y-%m-%d %H:%M:%S') if exec.executed_at else None,
#                 'status': exec.status,
#                 'error_message': exec.error_message if exec.status == 'FAILED' or exec.status == 'OUTPUT_ERROR' else None,
#             })

#         return JsonResponse({
#             'status': 'success',
#             'executions': execution_list
#         })

#     except QueryDefinition.DoesNotExist:
#         return JsonResponse({
#             'status': 'error',
#             'message': 'Query not found'
#         }, status=404)
#     except Exception as e:
#         return JsonResponse({
#             'status': 'error',
#             'message': str(e)
#         }, status=400)

# --------------- HERE is for Backend UI ---------------
