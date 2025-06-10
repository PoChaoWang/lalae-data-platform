# apps/connections/apis/google_sheet.py
import logging
from google.oauth2 import service_account
from google.api_core.exceptions import NotFound, Forbidden, GoogleAPICallError
from googleapiclient.discovery import build
from google.cloud import bigquery
from django.conf import settings
import io
import csv

logger = logging.getLogger(__name__)

# 將您的服務帳號金鑰路徑放在 settings.py 中
# settings.py
# GOOGLE_APPLICATION_CREDENTIALS = "/path/to/your/service-account-file.json"

class GoogleSheetAPIClient:
    def __init__(self):
        try:
            # 使用 settings.py 中定義的路徑
            self.credentials = service_account.Credentials.from_service_account_file(
                settings.GOOGLE_APPLICATION_CREDENTIALS,
                scopes=[
                    'https://www.googleapis.com/auth/spreadsheets.readonly',
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/bigquery'
                ]
            )
            self.service_account_email = self.credentials.service_account_email
            self.bq_client = bigquery.Client(credentials=self.credentials, project=self.credentials.project_id)
            self.sheets_service = build('sheets', 'v4', credentials=self.credentials)
            self.drive_service = build('drive', 'v3', credentials=self.credentials)
        except Exception as e:
            logger.error(f"[GoogleSheetAPIClient] Failed to initialize clients: {e}", exc_info=True)
            raise

    def check_sheet_permissions(self, sheet_id: str) -> bool:
        """
        使用 Drive API 檢查服務帳號是否對指定的 Sheet 有寫入權限。
        """
        try:
            logger.info(f"Checking permissions for sheet '{sheet_id}' for service account '{self.service_account_email}'")
            # 請求權限列表
            permissions = self.drive_service.files().get(
                fileId=sheet_id,
                fields='permissions(emailAddress,role)'
            ).execute().get('permissions', [])

            for p in permissions:
                if p.get('emailAddress') == self.service_account_email:
                    # 'writer' (編輯者) 或 'owner' (擁有者) 都有足夠權限
                    if p.get('role') in ['writer', 'owner']:
                        logger.info(f"Permission check PASSED. Role: {p.get('role')}")
                        return True
            
            logger.warning(f"Permission check FAILED for sheet '{sheet_id}'. Service account not found or has wrong role.")
            return False
        except Forbidden:
            logger.error(f"Permission check FAILED. The service account does not have access to sheet '{sheet_id}'. (Forbidden)")
            return False
        except Exception as e:
            # 處理 API 回傳的其他錯誤，例如 sheet_id 不存在
            logger.error(f"An unexpected error occurred during permission check for sheet '{sheet_id}': {e}", exc_info=True)
            return False

    def _convert_schema(self, columns_config: dict) -> list:
        """將使用者定義的 schema 轉換為 BigQuery SchemaField 物件列表。"""
        schema = []
        for col in columns_config.get('columns', []):
            field_name = col.get('name')
            field_type = col.get('type', 'STRING').upper()
            schema.append(bigquery.SchemaField(field_name, field_type))
        return schema

    def create_or_update_bigquery_table(self, dataset_id: str, table_name: str, schema_config: dict):
        """
        在 BigQuery 中建立或更新資料表。
        """
        dataset_ref = self.bq_client.dataset(dataset_id)
        table_ref = dataset_ref.table(table_name)
        schema = self._convert_schema(schema_config)

        table = bigquery.Table(table_ref, schema=schema)
        
        # 先建立 field_name → field_type 的對照表
        field_type_map = {field.name: field.field_type for field in schema}

        # 將日期欄位設為分區欄位（只有合法的 type 才設定）
        date_column = schema_config.get('date_column')
        if date_column:
            column_type = field_type_map.get(date_column)
            if column_type in ("TIMESTAMP", "DATE", "DATETIME"):
                table.time_partitioning = bigquery.TimePartitioning(
                    type_=bigquery.TimePartitioningType.DAY,
                    field=date_column
                )
                logger.info(f"Setting time partitioning on column '{date_column}' with type '{column_type}'.")
            else:
                logger.warning(
                    f"Cannot set time partitioning: column '{date_column}' type is '{column_type}', must be TIMESTAMP / DATE / DATETIME."
                )

        try:
            logger.info(f"Creating BigQuery table: {dataset_id}.{table_name}")
            created_table = self.bq_client.create_table(table)
            logger.info(f"Table {created_table.table_id} created successfully.")
            return created_table
        except GoogleAPICallError as e:
            # 如果資料表已存在，我們可以選擇更新它或直接忽略
            if "Already Exists" in str(e):
                logger.warning(f"Table {dataset_id}.{table_name} already exists. It will be used directly.")
                return self.bq_client.get_table(table_ref)
            else:
                logger.error(f"Failed to create BigQuery table: {e}", exc_info=True)
                raise
    
    def load_data_from_sheet(self, sheet_id: str, tab_name: str, dataset_id: str, table_name: str):
        """
        從 Google Sheet 讀取資料並載入到 BigQuery。
        """
        try:
            # 從第二行開始讀取所有資料
            range_name = f"'{tab_name}'!A2:Z"  # 讀取到最後一欄 Z
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range=range_name
            ).execute()

            values = result.get('values', [])

            logger.info(f"Data fetched from Google Sheets (first 5 rows): {values[:5]}")
            
            if not values:
                logger.warning(f"No data found in sheet '{sheet_id}' tab '{tab_name}' starting from row 2.")
                return 0

            table_ref = self.bq_client.dataset(dataset_id).table(table_name)

            # 取得 BigQuery table schema 的欄位名稱順序
            table = self.bq_client.get_table(table_ref)
            fieldnames = [field.name for field in table.schema]

            # 準備 CSV 格式的在記憶體中的檔案 (in-memory file)
            output = io.BytesIO()
            # TextIOWrapper 是必要的，用來在 BytesIO 和 csv writer 之間轉換
            wrapper = io.TextIOWrapper(output, encoding='utf-8', newline='')
            writer = csv.writer(wrapper)

            # 這裡不需要手動寫入表頭，因為我們會告訴 Load Job 跳過第一行
            # writer.writerow(fieldnames)

            # 確保寫入 CSV 的資料與 BigQuery schema 順序完全一致
            for row_values in values:
                # 確保每一行的長度都跟 schema 欄位數一樣，不足的補上空字串
                # 這一步很重要，可以避免 "Row has wrong number of fields" 錯誤
                full_row = (row_values + [''] * len(fieldnames))[:len(fieldnames)]
                writer.writerow(full_row)
            
            # `writerow` 是寫入到 wrapper 的緩存，我們需要 `flush` 來確保所有東西都寫入底層的 BytesIO
            wrapper.flush()

            # Load Job 設定
            output.seek(0) # 將指標移回檔案開頭
            job_config = bigquery.LoadJobConfig(
                source_format=bigquery.SourceFormat.CSV,
                # 因為我們的 CSV 資料沒有表頭，所以設定為 0
                skip_leading_rows=0, 
                # 讓 BigQuery 根據我們預先建立的 table schema 來解析資料
                schema=table.schema, 
                autodetect=False
            )

            logger.info(f"Starting Load Job to {dataset_id}.{table_name} ...")
            load_job = self.bq_client.load_table_from_file(
                output, 
                table_ref, 
                job_config=job_config
            )
            load_job.result()  # 等待工作完成

            logger.info(f"Successfully loaded {load_job.output_rows} rows to {dataset_id}.{table_name}")
            return load_job.output_rows

        except Exception as e:
            logger.error(f"Failed to load data from sheet to BigQuery: {e}", exc_info=True)
            raise