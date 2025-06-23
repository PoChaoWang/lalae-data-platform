from celery import shared_task
from django.utils import timezone
from .models import QueryRunResult, QueryDefinition
from datetime import date, datetime
from .services.bq_services import BigQueryService  # 修正類別名稱

from .services.gsheet_services import GSheetService # 你需要建立這個服務來封裝 GSheet 操作
from .services.looker_services import LookerService # 你需要建立這個服務來封裝 Looker 操作
from google.cloud import bigquery
import json
import csv
from io import StringIO
from google.api_core import exceptions as google_exceptions

@shared_task(bind=True, max_retries=3)  # bind=True 可以讓你存取 self (task instance)
def run_bigquery_query_task(self, run_result_id):
    print(f"[TASK START] run_bigquery_query_task for run_result_id: {run_result_id}")
    try:
        run_result = QueryRunResult.objects.get(pk=run_result_id) # 獲取 QueryRunResult
        query_def = run_result.query
        print(f"[TASK] Found QueryDefinition: {query_def.name}, Dataset: {query_def.bigquery_dataset_id}")
    except QueryRunResult.DoesNotExist:
        print(f"[TASK ERROR] QueryRunResult ID {run_result_id} not found. Aborting task.")
        return # 任務失敗，但不是通過 return 字串

    run_result.status = "RUNNING"
    run_result.executed_at = timezone.now()
    run_result.save()
    print(f"[TASK] RunResult {run_result_id} status set to RUNNING.")

    print(f"[TASK] BigQuery Project ID for this query: {query_def.bigquery_project_id}")
    bq_service = BigQueryService(project_id=query_def.bigquery_project_id) 
    gsheet_service = GSheetService() 
    looker_service = LookerService() 

    try:
        dataset_id = query_def.bigquery_dataset_id
        sql_query_raw = query_def.sql_query

        modified_sql_query = sql_query_raw.replace("FROM ", f"FROM `{dataset_id}`.")
        modified_sql_query = modified_sql_query.replace("JOIN ", f"JOIN `{dataset_id}`.")
        modified_sql_query = modified_sql_query.replace("INNER JOIN ", f"INNER JOIN `{dataset_id}`.")
        modified_sql_query = modified_sql_query.replace("LEFT JOIN ", f"LEFT JOIN `{dataset_id}`.")
        modified_sql_query = modified_sql_query.replace("RIGHT JOIN ", f"RIGHT JOIN `{dataset_id}`.")
        modified_sql_query = modified_sql_query.replace("FULL JOIN ", f"FULL JOIN `{dataset_id}`.")

        print(f"[TASK] Executing BigQuery query: {modified_sql_query}") 
        query_results_iterator, schema_fields, job_stats = bq_service.execute_query(sql=modified_sql_query) 
        print(f"[TASK] BigQuery query job completed successfully. Rows: {job_stats['total_rows']}, Processed Bytes: {job_stats['total_bytes_processed']}") 

        csv_buffer = StringIO()
        csv_writer = csv.writer(csv_buffer)

        column_names = [field.name for field in schema_fields]
        csv_writer.writerow(column_names)

        row_count = 0
        all_rows_for_output = []
        for row in query_results_iterator:
            processed_row_data_for_gsheet = [] 
            row_data_for_csv = [] 

            for value in row.values():
                if isinstance(value, (date, datetime)):
                    processed_row_data_for_gsheet.append(value.isoformat())
                    row_data_for_csv.append(value.isoformat())
                else:
                    processed_row_data_for_gsheet.append(value)
                    row_data_for_csv.append(str(value)) 

            csv_writer.writerow(row_data_for_csv) 
            all_rows_for_output.append(processed_row_data_for_gsheet) 

            row_count += 1

        run_result.result_rows_count = row_count
        run_result.result_data_csv = csv_buffer.getvalue()
        print(f"[TASK] Data processing complete. Rows fetched: {row_count}")

        # 2. 處理輸出目標
        output_type = query_def.output_target
        output_config = json.loads(query_def.output_config) if query_def.output_config else {} 
        print(f"[TASK] Output target: {output_type}, Config: {output_config}")

        if output_type == "GOOGLE_SHEET":
            sheet_id = output_config.get("sheet_id")
            tab_name = output_config.get("tab_name", "Sheet1")
            append_mode = output_config.get("append_mode", False) 

            if not sheet_id:
                raise ValueError("Google Sheet ID is not configured.")

            gsheet_service.write_to_sheet(sheet_id, tab_name, column_names, all_rows_for_output, append_mode)
            run_result.result_output_link = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
            run_result.result_message = f"Successfully exported to Google Sheet: {run_result.result_output_link}"
            print(f"[TASK] Data exported to Google Sheets.")

        elif output_type == "LOOKER_STUDIO":
            email_address = output_config.get("email")
            run_result.result_output_link = f"https://lookerstudio.google.com/reporting/your_report_id"
            run_result.result_message = f"Data exported for Google Looker Studio (Email: {email_address})."
            print(f"[TASK] Data exported for Google Looker Studio.")

        else:
            run_result.result_message = "No output configured for this query."
            print(f"[TASK] No specific output target configured.")

        run_result.status = "SUCCESS"
        run_result.query.last_successful_run_result = run_result
        run_result.query.last_run_status = "SUCCESS"
        run_result.query.save()

    except google_exceptions.GoogleAPIError as e: # 捕獲 Google Cloud API 特定錯誤
        print(f"[TASK ERROR] Google Cloud Error during BigQuery/Output: {e}") #
        run_result.status = "FAILED" #
        run_result.result_message = f"Google Cloud API error: {str(e)}" #
        self.retry(exc=e, countdown=60)

    except Exception as e:
        print(f"[TASK ERROR] Unexpected error during task execution: {e}")
        run_result.status = "FAILED"
        run_result.result_message = f"Query execution failed: {str(e)}"
        self.retry(exc=e, countdown=60) 
    finally:
        print(f"[TASK END] Execution {run_result_id} for query '{query_def.name}' completed with status {run_result.status}.")
        run_result.completed_at = timezone.now()
        run_result.save()
        run_result.query.save()

    # 如果是定期任務且成功，更新 QueryDefinition 的 next_run_at (如果手動管理排程)
    # 或者 Celery Beat 會自動處理下一次執行
    if query_def.schedule_type == "PERIODIC" and run_result.status == "SUCCESS":
        # 如果您使用 django-celery-beat 的 PeriodicTask，這裡無需額外更新
        # 如果是自定義的排程器，則需要更新 last_run_at
        pass
    print(f"Execution {run_result_id} for query '{query_def.name}' completed with status {run_result.status}.")
    return f"Execution {run_result_id} for query '{query_def.name}' completed with status {run_result.status}."


# schedule_periodic_queries 任務保持不變，它會負責根據 cron_schedule 創建 QueryExecution
# 當 QueryExecution 創建後，會調用 run_bigquery_query_task.delay(run_result.id)
# 確保這個任務會被 Celery Beat 定期執行

@shared_task
def schedule_periodic_queries():
    """
    此任務由 Celery Beat 定期觸發 (例如每分鐘或每五分鐘)。
    它檢查是否有 QueryDefinition 需要根據其 cron_schedule 執行。
    注意：如果使用 django-celery-beat，這個手動的排程器就不是必需的，
    因為 django-celery-beat 會直接根據 PeriodicTask 模型來調度 run_bigquery_query_task。
    """
    from croniter import croniter  # 需要 pip install croniter

    now = timezone.now()
    active_periodic_queries = (
        QueryDefinition.objects.filter(status="ACTIVE", schedule_type="PERIODIC")
        .exclude(cron_schedule__isnull=True)
        .exclude(cron_schedule__exact="")
    )

    for q_def in active_periodic_queries:
        iter = croniter(q_def.cron_schedule, now)
        prev_run_time = iter.get_prev(timezone.datetime)
        if (now - prev_run_time).total_seconds() < 60:  
            recent_execution = QueryRunResult.objects.filter(
                query_definition=q_def,
                triggered_by="SCHEDULED",
                started_at__gte=prev_run_time,
            ).exists()

            if not recent_execution:
                run_result = QueryRunResult.objects.create(
                    query_definition=q_def,
                    triggered_by="SCHEDULED",
                    status="PENDING",
                    # started_at 不在這裡設定，由 run_bigquery_query_task 設定
                )
                run_bigquery_query_task.delay(run_result.id)
                # q_def.last_run_at = now # 更新 QueryDefinition 上的最後執行時間戳
                # q_def.save()


# @shared_task(bind=True)
# def test_bigquery_query(self, sql_query):
#     """
#     Test a BigQuery query by running it with a LIMIT 10 clause
#     """
#     try:
#         # Initialize BigQuery client
#         client = bigquery.Client()

#         # Run the query with LIMIT 10
#         query = f"{sql_query} LIMIT 10"
#         query_job = client.query(query)

#         # Get results
#         results = []
#         for row in query_job:
#             results.append(dict(row.items()))

#         return {
#             'success': True,
#             'results': results
#         }

#     except Exception as e:
#         return {
#             'success': False,
#             'error': str(e)
#         }
