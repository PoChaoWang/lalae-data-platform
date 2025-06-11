from celery import shared_task
from django.utils import timezone
from .models import QueryExecution, QueryDefinition
from .services.bq_services import BigQueryService # 修正類別名稱
# from .gsheet_services import YourGSheetService # 你需要建立這個服務來封裝 GSheet 操作
# from .looker_services import YourLookerService # 你需要建立這個服務來封裝 Looker 操作
from google.cloud import bigquery
import json

@shared_task(bind=True, max_retries=3) # bind=True 可以讓你存取 self (task instance)
def run_bigquery_query_task(self, execution_id):
    try:
        execution = QueryExecution.objects.get(pk=execution_id)
        query_def = execution.query_definition
    except QueryExecution.DoesNotExist:
        # log error
        return f"Execution ID {execution_id} not found."

    execution.status = 'RUNNING'
    execution.started_at = timezone.now() # 精確的開始時間
    execution.save()

    # bq_service = YourBigQueryService(project_id=query_def.bigquery_project_id)
    # gsheet_service = YourGSheetService()
    # looker_service = YourLookerService()

    try:
        # 1. 執行 BigQuery 查詢
        # results, job_stats = bq_service.execute_query(
        #     sql=query_def.sql_query,
        #     dataset_id=query_def.bigquery_dataset_id,
        #     # destination_table=query_def.bigquery_destination_table # (可選)
        # )
        # execution.result_rows_count = job_stats.get('num_rows_processed', 0) # 或實際結果行數

        # --- 模擬成功 ---
        import time
        time.sleep(5) # 模擬長時間執行
        mock_results = [{'colA': 1, 'colB': 'Test'}, {'colA': 2, 'colB': 'Data'}]
        execution.result_rows_count = len(mock_results)
        # --- 模擬結束 ---

        # 2. 處理輸出
        if query_def.output_type == 'GSHEET':
            # sheet_url = gsheet_service.write_to_sheet(query_def.output_destination, results)
            # execution.result_output_link = sheet_url
            execution.result_output_link = f"https://docs.google.com/spreadsheets/d/mock_sheet_id_for_{execution.id}" # 模擬
            execution.result_message = f"成功輸出至 Google Sheet: {execution.result_output_link}"
        elif query_def.output_type == 'LOOKER':
            # 通常是確保 BigQuery 表格已更新，Looker Studio 會自動讀取
            # 或者，如果 Looker API 允許，可以觸發資料來源刷新
            # looker_report_url = looker_service.refresh_data_source(query_def.output_destination)
            # execution.result_output_link = looker_report_url
            execution.result_output_link = f"https://lookerstudio.google.com/reporting/mock_report_id_for_{execution.id}" # 模擬
            execution.result_message = f"資料已準備好供 Looker Studio ({query_def.output_destination}) 使用。"
        elif query_def.output_type == 'DOWNLOAD':
            # 將結果儲存到 GCS，並在 execution.result_storage_path 記錄路徑
            # gcs_path = bq_service.save_results_to_gcs(results, f"query_results/execution_{execution.id}.csv")
            # execution.result_storage_path = gcs_path
            execution.result_storage_path = f"gs://your-bucket/query_results/execution_{execution.id}.csv" # 模擬
            execution.result_message = f"結果已儲存至 GCS: {execution.result_storage_path}"
        else:
            execution.result_message = "未知的輸出類型或無需特定輸出操作。"

        execution.status = 'SUCCESS'

    except Exception as e:
        # log error
        execution.status = 'FAILED'
        execution.result_message = f"查詢執行失敗: {str(e)}"
        # self.retry(exc=e, countdown=60) # 設定重試，例如60秒後
        # return f"Task failed for execution {execution_id}: {str(e)}"
    finally:
        execution.completed_at = timezone.now()
        execution.save()

    # 如果是定期任務且成功，需要更新 QueryDefinition 的 next_run_at (如果手動管理排程)
    # 或者 Celery Beat 會自動處理下一次執行
    if query_def.schedule_type == 'PERIODIC' and execution.status == 'SUCCESS':
        # 更新 QueryDefinition 相關的排程邏輯 (如果不是用 django-celery-beat)
        pass

    return f"Execution {execution_id} for query '{query_def.name}' completed with status {execution.status}."


# 你還需要一個排程任務來檢查 QueryDefinition 中設定的 CRON
# 如果使用 django-celery-beat，它會自動處理 PeriodicTask
# 如果手動管理，你需要一個 Celery Beat 排程來定期執行下面的任務
@shared_task
def schedule_periodic_queries():
    """
    此任務由 Celery Beat 定期觸發 (例如每分鐘或每五分鐘)。
    它檢查是否有 QueryDefinition 需要根據其 cron_schedule 執行。
    注意：如果使用 django-celery-beat，這個手動的排程器就不是必需的，
    因為 django-celery-beat 會直接根據 PeriodicTask 模型來調度 run_bigquery_query_task。
    """
    from croniter import croniter # 需要 pip install croniter
    now = timezone.now()
    active_periodic_queries = QueryDefinition.objects.filter(
        status='ACTIVE',
        schedule_type='PERIODIC'
    ).exclude(cron_schedule__isnull=True).exclude(cron_schedule__exact='')

    for q_def in active_periodic_queries:
        # 這裡的邏輯是：如果 croniter 的上一個排定時間點在最近一個檢查週期內
        # 且我們還沒有為這個時間點執行過，就執行它。
        # 更簡單的方式是，如果 QueryDefinition 有一個 `last_scheduled_run` 欄位，
        # 就可以用 croniter(q_def.cron_schedule, q_def.last_scheduled_run).get_next(datetime)
        # 來判斷是否 `next_run <= now`

        # 這裡使用一個簡化的檢查：如果 croniter 表示現在是執行時間
        iter = croniter(q_def.cron_schedule, now)
        # 檢查上一個排定執行時間是否在一個很短的時間窗口內 (例如前一分鐘)
        # 這樣可以避免重複執行，但需要更精確的邏輯來處理 `last_run_at`
        prev_run_time = iter.get_prev(timezone.datetime)
        if (now - prev_run_time).total_seconds() < 60: # 假設此任務每分鐘運行一次
            # 檢查是否近期已經為此排程點執行過 (避免重複)
            # 這需要更完善的鎖定或 last_triggered_at 欄位
            recent_execution = QueryExecution.objects.filter(
                query_definition=q_def,
                triggered_by='SCHEDULED',
                started_at__gte=prev_run_time
            ).exists()

            if not recent_execution:
                execution = QueryExecution.objects.create(
                    query_definition=q_def,
                    triggered_by='SCHEDULED',
                    status='PENDING'
                    # started_at 不在這裡設定，由 run_bigquery_query_task 設定
                )
                run_bigquery_query_task.delay(execution.id)
                # q_def.last_run_at = now # 更新 QueryDefinition 上的最後執行時間戳
                # q_def.save()

@shared_task(bind=True)
def test_bigquery_query(self, sql_query):
    """
    Test a BigQuery query by running it with a LIMIT 10 clause
    """
    try:
        # Initialize BigQuery client
        client = bigquery.Client()
        
        # Run the query with LIMIT 10
        query = f"{sql_query} LIMIT 10"
        query_job = client.query(query)
        
        # Get results
        results = []
        for row in query_job:
            results.append(dict(row.items()))
        
        return {
            'success': True,
            'results': results
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }