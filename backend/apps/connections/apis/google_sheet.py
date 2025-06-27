# apps/connections/apis/google_sheet.py
import logging
from google.oauth2 import service_account
from google.api_core.exceptions import NotFound, Forbidden, GoogleAPICallError
from googleapiclient.discovery import build
from google.cloud import bigquery
from django.conf import settings
import google.auth
import io
import csv

logger = logging.getLogger(__name__)

# 將您的服務帳號金鑰路徑放在 settings.py 中
# settings.py
# GOOGLE_APPLICATION_CREDENTIALS = "/path/to/your/service-account-file.json"


class GoogleSheetAPIClient:
    def __init__(self):
        try:
            self.credentials, self.project_id = google.auth.default( #
                scopes=[
                    "https://www.googleapis.com/auth/spreadsheets",         
                    "https://www.googleapis.com/auth/drive.readonly",    
                    "https://www.googleapis.com/auth/bigquery",           
                    "https://www.googleapis.com/auth/bigquery.insertdata", 
                ]
            )
            
            if hasattr(self.credentials, 'service_account_email') and \
               self.credentials.service_account_email not in ['default', 'unknown_service_account']:
                self.service_account_email = self.credentials.service_account_email
            else:
                self.service_account_email = 'bot-681@my-project-for-bigquery-445809.iam.gserviceaccount.com' 

            logger.info(f"Initialized GoogleSheetAPIClient with service account: {self.service_account_email}") 

            # 初始化 BigQuery 客戶端
            self.bq_client = bigquery.Client(
                credentials=self.credentials, project=self.project_id
            )

            # 初始化 Google Sheets 和 Drive 服務
            self.sheets_service = build("sheets", "v4", credentials=self.credentials)
            self.drive_service = build("drive", "v3", credentials=self.credentials)

        except Exception as e:
            logger.error(
                f"[GoogleSheetAPIClient] Failed to initialize clients due to credential or API setup: {e}",
                exc_info=True,
            )
            raise RuntimeError(f"Failed to initialize Google Sheet API Client: {str(e)}")

    def check_sheet_permissions(self, sheet_id: str) -> bool:
        """
        使用 Drive API 檢查服務帳號是否對指定的 Sheet 有寫入權限。
        """
        try:
            logger.info(f"*** DEBUG: self.service_account_email is: '{self.service_account_email}' ***")
            logger.info(
                f"Checking permissions for sheet '{sheet_id}' for service account '{self.service_account_email}'"
            )
            # 請求權限列表
            permissions = (
                self.drive_service.files()
                .get(fileId=sheet_id, fields="permissions(emailAddress,role)")
                .execute()
                .get("permissions", [])
            )
            logger.info(f"Permissions fetched from Drive API for sheet '{sheet_id}': {permissions}")

            for p in permissions:
                logger.info(f"*** DEBUG: Comparing permission email '{p.get('emailAddress')}' with service account email '{self.service_account_email}' ***")
                if p.get("emailAddress") == self.service_account_email:
                    logger.info(f"*** DEBUG: Email addresses MATCHED. Role is: '{p.get('role')}' ***")
                    if p.get("role") in ["writer", "owner"]:
                        logger.info(f"Permission check PASSED. Role: {p.get('role')}")
                        return True

            logger.warning(
                f"Permission check FAILED for sheet '{sheet_id}'. Service account not found or has wrong role."
            )
            return False
        except Forbidden:
            logger.error(
                f"Permission check FAILED. The service account does not have access to sheet '{sheet_id}'. (Forbidden)"
            )
            return False
        except Exception as e:
            # 處理 API 回傳的其他錯誤，例如 sheet_id 不存在
            logger.error(
                f"An unexpected error occurred during permission check for sheet '{sheet_id}': {e}",
                exc_info=True,
            )
            return False

    def _convert_schema(self, schema_dict):
        # 確保 schema_dict 是一個字典
        if not isinstance(schema_dict, dict):
            # 如果傳入的不是字典，記錄錯誤或拋出更明確的異常
            logger.error(
                f"Invalid schema_dict type: Expected dict, got {type(schema_dict)}. Value: {schema_dict}"
            )
            raise ValueError("Schema configuration is invalid. Expected a dictionary.")

        # 從 schema_dict 中獲取 'columns' 列表
        columns = schema_dict.get("columns", [])

        # 現在對 'columns' 列表進行迭代
        converted_fields = []
        for col in columns:
            field_name = col.get("name")
            field_type = col.get("type")
            field_mode = col.get("mode", "NULLABLE")  # 預設為 NULLABLE

            if not field_name or not field_type:
                logger.warning(f"Skipping malformed schema column: {col}")
                continue

            field = bigquery.SchemaField(field_name, field_type, mode=field_mode)
            converted_fields.append(field)

        return converted_fields

    def create_or_update_bigquery_table(
        self, dataset_id: str, table_name: str, schema_config: dict
    ):
        """
        在 BigQuery 中建立或更新資料表。
        """
        dataset_ref = self.bq_client.dataset(dataset_id)
        table_ref = dataset_ref.table(table_name)
        schema = self._convert_schema(schema_config)

        table = bigquery.Table(table_ref, schema=schema)

        # 先建立 field_name → field_type 的對照表
        # field_type_map = {field.name: field.field_type for field in schema}

        # 將日期欄位設為分區欄位（只有合法的 type 才設定）
        # date_column = schema_config.get("date_column")
        # if date_column:
        #     column_type = field_type_map.get(date_column)
        #     if column_type in ("TIMESTAMP", "DATE", "DATETIME"):
        #         table.time_partitioning = bigquery.TimePartitioning(
        #             type_=bigquery.TimePartitioningType.DAY, field=date_column
        #         )
        #         logger.info(
        #             f"Setting time partitioning on column '{date_column}' with type '{column_type}'."
        #         )
        #     else:
        #         logger.warning(
        #             f"Cannot set time partitioning: column '{date_column}' type is '{column_type}', must be TIMESTAMP / DATE / DATETIME."
        #         )

        try:
            logger.info(f"Creating BigQuery table: {dataset_id}.{table_name}")
            created_table = self.bq_client.create_table(table)
            logger.info(f"Table {created_table.table_id} created successfully.")
            return created_table
        except GoogleAPICallError as e:
            # 如果資料表已存在，我們可以選擇更新它或直接忽略
            if "Already Exists" in str(e):
                logger.warning(
                    f"Table {dataset_id}.{table_name} already exists. It will be used directly."
                )
                return self.bq_client.get_table(table_ref)
            else:
                logger.error(f"Failed to create BigQuery table: {e}", exc_info=True)
                raise

    def load_data_from_sheet(
        self, sheet_id: str, tab_name: str, dataset_id: str, table_name: str
    ):
        """
        從 Google Sheet 讀取資料並載入到 BigQuery。
        """
        try:
            range_name = f"'{tab_name}'!A2:Z"  # 讀取到最後一欄 Z
            result = (
                self.sheets_service.spreadsheets()
                .values()
                .get(spreadsheetId=sheet_id, range=range_name)
                .execute()
            )

            values = result.get("values", [])

            logger.info(f"Data fetched from Google Sheets (first 5 rows): {values[:5]}")

            if not values:
                logger.warning(
                    f"No data found in sheet '{sheet_id}' tab '{tab_name}' starting from row 2."
                )
                return 0

            table_ref = self.bq_client.dataset(dataset_id).table(table_name)
            table = self.bq_client.get_table(table_ref)
            fieldnames = [field.name for field in table.schema]

            output = io.BytesIO()
            wrapper = io.TextIOWrapper(output, encoding="utf-8", newline="")
            writer = csv.writer(wrapper)

            for row_values in values:
                full_row = (row_values + [""] * len(fieldnames))[: len(fieldnames)]
                writer.writerow(full_row)

            wrapper.flush()

            # Load Job 設定
            output.seek(0)
            print("--- Content of BytesIO (as string) ---")
            print(output.getvalue().decode("utf-8"))  # 將 BytesIO 內容解碼並打印
            print("--------------------------------------")
            job_config = bigquery.LoadJobConfig(
                source_format=bigquery.SourceFormat.CSV,
                skip_leading_rows=0,
                schema=table.schema,
                write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
                autodetect=False,
            )

            logger.info(f"Starting Load Job to {dataset_id}.{table_name} ...")
            load_job = self.bq_client.load_table_from_file(
                output, table_ref, job_config=job_config
            )
            load_job.result()  # 等待工作完成

            if load_job.errors:
                logger.error(
                    f"BigQuery Load Job errors for {dataset_id}.{table_name}: {load_job.errors}"
                )
                raise Exception(
                    f"BigQuery Load Job failed with errors: {load_job.errors}"
                )

            logger.info(
                f"Successfully loaded {load_job.output_rows} rows to {dataset_id}.{table_name}"
            )
            return load_job.output_rows

        except Exception as e:
            logger.error(
                f"Failed to load data from sheet to BigQuery: {e}", exc_info=True
            )
            raise
