from google.cloud import bigquery
from google.oauth2 import service_account # 如果使用服務帳號
from django.conf import settings

class BigQueryService:
    def __init__(self, project_id=None, credentials_path=None):
        # credentials_path 可以從 settings.GOOGLE_APPLICATION_CREDENTIALS 讀取
        # project_id 也可以從 settings 或傳入
        self.project_id = project_id or settings.GCP_PROJECT_ID
        if credentials_path:
            self.credentials = service_account.Credentials.from_service_account_file(credentials_path)
            self.client = bigquery.Client(project=self.project_id, credentials=self.credentials)
        else:
            # 預期環境已設定 GOOGLE_APPLICATION_CREDENTIALS 環境變數
            self.client = bigquery.Client(project=self.project_id)

    def execute_query(self, sql, dataset_id=None, destination_table_name=None):
        job_config = bigquery.QueryJobConfig()
        if destination_table_name and dataset_id:
            table_ref = self.client.dataset(dataset_id).table(destination_table_name)
            job_config.destination = table_ref
            job_config.write_disposition = bigquery.WriteDisposition.WRITE_TRUNCATE # 或 WRITE_APPEND

        query_job = self.client.query(sql, job_config=job_config)
        # 等待完成 (對於長時間運行的任務， Celery task 中可能不需要 .result() 立刻等待)
        # 如果是設定了 destination_table, query_job.result() 會在表格寫入完成後返回
        # 如果沒有 destination_table, query_job.result() 會返回結果迭代器
        results = query_job.result() # 這會阻塞直到查詢完成

        job_stats = {
            'job_id': query_job.job_id,
            'created': query_job.created,
            'started': query_job.started,
            'ended': query_job.ended,
            'total_bytes_billed': query_job.total_bytes_billed,
            'total_bytes_processed': query_job.total_bytes_processed,
            # ... 其他統計數據
        }
        if not destination_table_name: # 如果是 SELECT 查詢且沒有存到目標表
            job_stats['num_rows_returned'] = results.total_rows
            # 將結果轉換為 list of dicts
            # rows = [dict(row) for row in results]
            # return rows, job_stats
            return results, job_stats # 直接回傳迭代器，由呼叫者處理
        else:
            # 如果有目標表，通常結果行數需要另外查詢，或者 BQ API 可能提供
            # destination_table = self.client.get_table(table_ref)
            # job_stats['num_rows_in_destination'] = destination_table.num_rows
            return None, job_stats # 表示結果已寫入表格

    def save_results_to_gcs(self, query_results_iterator, gcs_path_prefix, format='CSV'):
        # 實作將 BigQuery 結果迭代器中的數據格式化並上傳到 GCS 的邏輯
        # 例如： gs://your-bucket/query_results/execution_123.csv
        # 返回 GCS 檔案的路徑
        # from google.cloud import storage
        # storage_client = storage.Client(project=self.project_id, credentials=self.credentials)
        # bucket_name, blob_name = gcs_path_prefix.replace("gs://", "").split("/", 1)
        # bucket = storage_client.bucket(bucket_name)
        # blob = bucket.blob(blob_name)
        #
        # # 假設 results 是一個 list of dicts
        # if format == 'CSV':
        #     import csv
        #     from io import StringIO
        #     si = StringIO()
        #     if query_results_iterator:
        #         # 取得欄位名
        #         first_row = next(iter(query_results_iterator), None)
        #         if first_row:
        #             fieldnames = list(dict(first_row).keys())
        #             writer = csv.DictWriter(si, fieldnames=fieldnames)
        #             writer.writeheader()
        #             writer.writerow(dict(first_row)) # 寫入第一行
        #             for row in query_results_iterator: # 繼續寫入剩餘行
        #                 writer.writerow(dict(row))
        #     blob.upload_from_string(si.getvalue(), content_type='text/csv')
        # elif format == 'JSON':
        #     import json
        #     # ... 轉換為 JSON lines 或 JSON array
        #     # blob.upload_from_string(json_data, content_type='application/json')
        # else:
        #     raise ValueError("Unsupported format for GCS export")
        # return f"gs://{bucket_name}/{blob_name}"
        pass # 這裡需要完整實作