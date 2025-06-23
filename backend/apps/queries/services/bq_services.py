# services/bq_services.py
from google.cloud import bigquery
from google.api_core import exceptions

class BigQueryService:
    def __init__(self, project_id=None):
        self.client = bigquery.Client(project=project_id)

    def execute_query(self, sql: str):
        """
        執行 BigQuery 查詢。
        返回一個迭代器 (rows)、schema 資訊和 job 統計。
        """
        try:
            query_job = self.client.query(sql)
            results = query_job.result() # 等待查詢完成

            # 獲取 schema 資訊
            schema_fields = results.schema

            # 獲取 job 統計資訊 (例如處理的位元組數)
            job_stats = {
                "total_bytes_processed": query_job.total_bytes_processed,
                "total_rows": results.total_rows,
                "job_id": query_job.job_id,
            }
            return results, schema_fields, job_stats # results 是一個迭代器
        except exceptions.BadRequest as e:
            raise ValueError(f"BigQuery SQL Syntax Error: {str(e)}")
        except exceptions.Forbidden as e:
            raise PermissionError(f"BigQuery Permission Denied: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"BigQuery Query Execution Failed: {str(e)}")

    def save_results_to_gcs(self, csv_data: str, gcs_path: str):
        """
        將 CSV 資料儲存到 Google Cloud Storage。
        （這裡只是示意，實際需要 GCP Storage 客戶端）
        """
        # from google.cloud import storage
        # storage_client = storage.Client()
        # bucket_name = gcs_path.split('/')[2] # 從 gs://bucket/path 中解析 bucket 名稱
        # blob_name = '/'.join(gcs_path.split('/')[3:])
        # bucket = storage_client.bucket(bucket_name)
        # blob = bucket.blob(blob_name)
        # blob.upload_from_string(csv_data, content_type='text/csv')
        print(f"Mock: Saving results to GCS at {gcs_path}")
        return gcs_path

    # 你可能還會需要一個方法來寫入 BigQuery 表格，如果 Looker Studio 是直接讀取目標表的話
    # def write_to_table(self, rows: list, project_id: str, dataset_id: str, table_id: str, schema: list):
    #     table_ref = self.client.dataset(dataset_id, project=project_id).table(table_id)
    #     job_config = bigquery.LoadJobConfig(schema=schema, write_disposition="WRITE_TRUNCATE") # 或者 WRITE_APPEND
    #     job = self.client.load_table_from_rows(rows, table_ref, job_config=job_config)
    #     job.result() # 等待 job 完成
    #     print(f"Data loaded into BigQuery table {table_id}")