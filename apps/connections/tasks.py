import logging
from celery import shared_task
from django.conf import settings
from google.cloud import bigquery
from google.api_core.exceptions import NotFound

from .models import Connection
from .apis.facebook_ads import FacebookAdsAPIClient
from .apis.google_oauth import run_custom_gaql_and_save
# from .apis.google_ads import GoogleAdsAPIClient # 未來加入
from allauth.socialaccount.models import SocialToken
from django.utils import timezone
import calendar


logger = logging.getLogger(__name__)

# --- API 客戶端工廠 (一個好的設計模式) ---
def get_api_client(connection):
    """根據 Connection 物件，返回對應的 API Client 實例。"""
    
    # 1. 取得授權 token
    if not connection.social_account:
        raise Exception("Connection is not linked to a social account.")
    
    try:
        # 這假設 token 總是存在，之後會討論 token 過期的問題
        token_obj = SocialToken.objects.get(account=connection.social_account)
        access_token = token_obj.token
    except SocialToken.DoesNotExist:
        raise Exception("SocialToken not found for this connection.")

    # 2. 根據資料來源，初始化對應的 Client
    source_name = connection.data_source.name
    if source_name == "FACEBOOK_ADS":
        return FacebookAdsAPIClient(
            app_id=settings.FACEBOOK_APP_ID,
            app_secret=settings.FACEBOOK_APP_SECRET,
            access_token=access_token,
            ad_account_id=connection.config.get('facebook_ad_account_id')
        )
    # elif source_name == "GOOGLE_ADS":
    #     # 未來 Google Ads 的 Client 初始化邏輯
    #     return GoogleAdsAPIClient(...) 
    else:
        raise NotImplementedError(f"API Client for data source '{source_name}' is not implemented.")


@shared_task(bind=True, max_retries=3, default_retry_delay=60) # 增加重試機制
def sync_connection_data_task(self, connection_id):
    """
    核心任務：同步單一 Connection 的資料到 BigQuery。
    """
    connection = Connection.objects.filter(pk=connection_id).first()

    if not connection:
        logger.error(f"Connection with ID {connection_id} not found. Task cannot run.")
        return

    # 任務開始時，立刻將狀態更新為「同步中」
    connection.status = 'SYNCING'
    connection.save(update_fields=['status'])

    try:
        # 1. 獲取 API Client
        api_client = get_api_client(connection)

        # 2. 根據 connection.config 中的設定，向 API 請求資料
        # 這裡的邏輯會很複雜，您需要根據不同 API 設計
        config = connection.config
        data = []
        if connection.data_source.name == "FACEBOOK_ADS":
            # 讀取使用者儲存的設定
            data = api_client.get_insights(
                fields=config.get('selected_fields', []),
                date_preset=config.get('date_preset'), # 或處理 custom date
                extra_params={'level': config.get('insights_level')}
            )
        elif connection.data_source.name == 'GOOGLE_ADS':
            success, message = run_custom_gaql_and_save(connection)
        else:
            success, message = (False, f"Sync not implemented for data source: {connection.data_source.name}")

        # 3. 準備 BigQuery
        bq_client = bigquery.Client()
        dataset_id = connection.target_dataset_id
        table_name = connection.display_name.replace(" ", "_").lower() # 確保 table name 合法
        table_ref = bq_client.dataset(dataset_id).table(table_name)
        # ... 其他資料來源的邏輯 ...
        if data:
            # 4. 動態建立 Schema
            # 從第一筆資料的 keys 來推斷 schema
            first_row = data[0]
            schema = [
                bigquery.SchemaField(key, "STRING") for key in first_row.keys() # 預設全為 STRING，可再優化
            ]

            # 5. 載入資料到 BigQuery
            job_config = bigquery.LoadJobConfig(
                schema=schema,
                autodetect=False, # 我們自己定義 schema
                source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
                write_disposition="WRITE_TRUNCATE", # 每次同步都覆蓋前一天的資料
                # 如果是增量更新，可以用 "WRITE_APPEND"
                schema_update_options=[ # 允許未來增加欄位
                    bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION
                ]
            )
            try:
                bq_client.get_table(table_ref) # 檢查 table 是否存在
            except NotFound:
                logger.info(f"Table {table_name} not found. Creating it.")
                table = bigquery.Table(table_ref, schema=schema)
                bq_client.create_table(table)

            load_job = bq_client.load_table_from_json(
                data, table_ref, job_config=job_config
            )
            load_job.result() # 等待任務完成
            connection.last_sync_status = "SUCCESS"
            connection.last_sync_record_count = len(data)
            connection.last_sync_status = message
            logger.info(f"Successfully prepared {len(data)} rows for connection {connection_id}.")
        else:
            connection.last_sync_status = "SUCCESS_NO_DATA"
            connection.last_sync_record_count = 0
            connection.last_sync_status = message
            logger.info(f"No data returned from API for connection {connection_id}. Sync finished.")

    except Exception as e:
        logger.error(f"Error syncing connection {connection_id}: {e}", exc_info=True)
        # 記錄錯誤狀態和錯誤訊息
        connection.status = 'ERROR'
        connection.last_sync_status = message
        connection.last_sync_record_count = None # 失敗時清除筆數
        # Celery 重試機制
        self.retry(exc=e)
    
    finally:
        # 無論成功或失敗，最後都會執行這裡，確保狀態和時間被更新
        # 如果任務執行完畢時狀態仍是 SYNCING (代表沒有出錯)，則將其改回 ACTIVE
        if connection.status == 'SYNCING':
            connection.status = 'ACTIVE'
        
        # 更新最後同步時間
        connection.last_sync_time = timezone.now()
        
        # 一次性儲存所有需要更新的欄位
        connection.save(update_fields=[
            'status', 
            'last_sync_time', 
            'last_sync_status', 
            'last_sync_record_count'
        ])
        logger.info(f"Final status for connection {connection_id} saved as '{connection.status}'.")

@shared_task
def schedule_periodic_syncs_task():
    """
    由 Celery Beat 每分鐘執行一次，精確檢查並派發到期的同步任務。
    """
    now = timezone.now()
    logger.info(f"Running periodic sync scheduler at: {now.strftime('%Y-%m-%d %H:%M')}")

    # 找出所有需要定期同步的、處於活動或錯誤狀態的連線
    connections_to_check = Connection.objects.filter(
        status__in=["ACTIVE", "ERROR"],
        config__sync_frequency__in=["daily", "weekly", "monthly"]
    ).exclude(config__has_key='sync_hour') # 確保 config 中有 sync_hour 才處理

    for conn in connections_to_check:
        try:
            # 從 config 中讀取使用者設定的時間，並轉換為整數
            sync_hour = int(conn.config.get('sync_hour', 0))
            sync_minute = int(conn.config.get('sync_minute', 0))

            # --- 核心判斷邏輯 ---

            # 1.【時間精確匹配】檢查現在的「時」和「分」是否與設定的完全一致
            if now.hour != sync_hour or now.minute != sync_minute:
                continue  # 時間不對，直接跳過這個連線

            # 2.【防止重複執行】檢查今天是否已經同步過
            #    這很重要，因為此任務現在每分鐘都跑
            if conn.last_sync_time and conn.last_sync_time.date() == now.date():
                continue # 今天已經同步過了，跳過

            # 3.【頻率日期匹配】檢查今天的日期是否符合 daily/weekly/monthly 的規則
            freq = conn.config.get('sync_frequency')
            should_run = False
            if freq == "daily":
                should_run = True
            elif freq == "weekly":
                # weekday() 回傳：週一=0, 週二=1 ... 週日=6
                # 假設您在 form 中儲存的也是這個格式
                day_of_week = conn.config.get('weekly_day_of_week') 
                if str(now.weekday()) == day_of_week:
                    should_run = True
            elif freq == "monthly":
                day_of_month = conn.config.get('monthly_day_of_month')
                if str(now.day) == day_of_month:
                    should_run = True
            
            # --- 派發任務 ---
            if should_run:
                logger.info(f"Dispatching sync task for connection {conn.pk} as per its '{freq}' schedule at {sync_hour:02}:{sync_minute:02}.")
                sync_connection_data_task.delay(conn.pk)

        except (ValueError, TypeError) as e:
            logger.error(f"Could not parse schedule for connection {conn.pk}. Config: {conn.config}. Error: {e}")
            continue # 如果某個連線的 config 格式錯誤，跳過它，不要影響其他任務