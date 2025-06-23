import logging
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.utils import timezone
from django.contrib.auth.models import User
from google.cloud import bigquery
from google.api_core.exceptions import NotFound

from .models import Connection
from .apis.facebook_ads import FacebookAdsAPIClient
from .apis.google_oauth import GoogleAdsAPIClient
from allauth.socialaccount.models import SocialToken

from .models import Connection, ConnectionExecution
from .apis.facebook_ads import FacebookAdsAPIClient
from .apis.google_oauth import GoogleAdsAPIClient
from .apis.google_sheet import GoogleSheetAPIClient
from allauth.socialaccount.models import SocialToken


logger = logging.getLogger(__name__)


# --- API 客戶端工廠  ---
def get_api_client(connection):
    source_name = connection.data_source.name
    if source_name == "FACEBOOK_ADS":
        if not connection.client or not connection.client.facebook_social_account:
            raise Exception(
                f"Connection {connection.id} is not linked to a Client, or its Client is not linked to a Facebook social account."
            )
        # token_obj = SocialToken.objects.get(account=connection.social_account)
        token_obj = SocialToken.objects.get(
            account=connection.client.facebook_social_account
        )
        return FacebookAdsAPIClient(
            app_id=settings.FACEBOOK_APP_ID,
            app_secret=settings.FACEBOOK_APP_SECRET,
            access_token=token_obj.token,
            ad_account_id=connection.config.get("facebook_ad_account_id"),
        )
    elif source_name == "GOOGLE_ADS":
        return GoogleAdsAPIClient(connection=connection)
    elif source_name == "GOOGLE_SHEET":
        # ✨ 新增 Google Sheet 的 client
        return GoogleSheetAPIClient()
    else:
        raise NotImplementedError(
            f"API Client for data source '{source_name}' is not implemented."
        )


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_connection_data_task(self, connection_id, triggered_by_user_id=None):
    """
    核心任務：同步單一 Connection 的資料到 BigQuery，並建立執行紀錄。
    """
    connection = Connection.objects.filter(pk=connection_id).first()
    if not connection:
        logger.error(f"Connection with ID {connection_id} not found.")
        return

    # 任務執行前，再次檢查開關。雖然排程器已檢查過，但手動觸發時也需要檢查。
    if not connection.is_enabled:
        logger.warning(
            f"Sync task for connection {connection_id} was triggered, but the connection is disabled. Skipping."
        )
        return

    logger.info(
        f"--- [DEBUG] Task running for Connection ID {connection_id}. Its data_source.name is: '{connection.data_source.name}' ---"
    )

    # --- 步驟 1: 建立執行紀錄 (Execution Record) ---
    trigger_method = "MANUAL" if triggered_by_user_id else "SYSTEM"
    triggered_by_user = (
        User.objects.filter(pk=triggered_by_user_id).first()
        if triggered_by_user_id
        else None
    )

    execution = ConnectionExecution.objects.create(
        connection=connection,
        triggered_by=triggered_by_user,
        trigger_method=trigger_method,
        status="RUNNING",
        config_snapshot=connection.config,
        display_name_snapshot=connection.display_name,
        target_dataset_id_snapshot=connection.target_dataset_id,
    )

    # 更新 Connection 的即時狀態為 "同步中"
    connection.status = "SYNCING"
    connection.save(update_fields=["status"])

    try:
        api_client = get_api_client(connection)
        data_to_load = []

        # === 獲取資料 ===
        if isinstance(api_client, FacebookAdsAPIClient):
            config = connection.config
            data_to_load = api_client.get_insights(
                fields=config.get("selected_fields", []),
                date_preset=config.get("date_preset"),
                extra_params={"level": config.get("insights_level")},
            )
            logger.info(f"FacebookAdsAPIClient returned {len(data_to_load)} rows.")

            # --- START: 新增的 BigQuery 寫入邏輯 ---
            if data_to_load:
                loaded_row_count = api_client.write_insights_to_bigquery(
                    dataset_id=connection.target_dataset_id,
                    table_name=connection.display_name,  # 使用 connection name 作為 table name
                    insights_data=data_to_load,
                )
                execution.message = f"Successfully fetched {len(data_to_load)} rows from Facebook and loaded {loaded_row_count} rows into BigQuery."
                execution.record_count = loaded_row_count
            else:
                execution.message = "Successfully connected to Facebook, but no data was returned for the selected period."
                execution.record_count = 0
            # --- END: 新增的 BigQuery 寫入邏輯 ---

        elif isinstance(api_client, GoogleAdsAPIClient):
            success, message = api_client.run_query_and_save()
            if not success:
                raise Exception(message)
            # Google Client 內部處理了資料寫入，這裡直接更新紀錄
            execution.message = message
            logger.info("GoogleAdsAPIClient executed successfully.")

        elif isinstance(api_client, GoogleSheetAPIClient):
            # ✨ 處理 Google Sheet 的同步
            logger.info(f"Starting Google Sheet sync for connection {connection.id}")
            config = connection.config

            # 確保 schema_config 是字典，且包含 'columns' 鍵
            schema_config_from_connection = config.get("schema")
            if isinstance(schema_config_from_connection, list):
                # 如果 schema_config 直接是一個列表，我們需要將它包裝成預期的字典格式
                # 這發生在你的 `onConfigChange` 函數傳遞 `schema: { columns: formState.schema }` 時
                # 但 `Connection.config` 儲存的可能直接是 `formState.schema`
                # 所以在這裡做一個防禦性檢查和轉換
                corrected_schema_config = {"columns": schema_config_from_connection}
            elif (
                isinstance(schema_config_from_connection, dict)
                and "columns" in schema_config_from_connection
            ):
                # 已經是正確的格式
                corrected_schema_config = schema_config_from_connection
            else:
                # 處理其他非預期情況，例如 schema_config 為 None 或空字典
                logger.warning(
                    f"Schema config for connection {connection.id} is not in expected format: {schema_config_from_connection}. Defaulting to empty schema."
                )
                corrected_schema_config = {"columns": []}

            # 1. 建立或更新 BigQuery 資料表
            api_client.create_or_update_bigquery_table(
                dataset_id=connection.target_dataset_id,
                table_name=connection.display_name,
                schema_config=corrected_schema_config,  # 使用修正後的 schema_config
            )

            # 2. 從 Sheet 載入資料
            record_count = api_client.load_data_from_sheet(
                sheet_id=config.get("sheet_id"),
                tab_name=config.get("tab_name"),
                dataset_id=connection.target_dataset_id,
                table_name=connection.display_name,
            )

            execution.message = f"Successfully fetched and loaded {record_count} rows from Google Sheet."
            execution.record_count = record_count

        # === 載入資料到 BigQuery (若有) ===
        if data_to_load:
            # ... (BigQuery loading logic remains the same) ...

            # 更新執行紀錄
            execution.message = (
                f"Successfully fetched and loaded {len(data_to_load)} rows."
            )
            execution.record_count = len(data_to_load)

        elif not isinstance(api_client, GoogleAdsAPIClient):
            execution.message = (
                "Successfully connected, but no data returned for the period."
            )
            execution.record_count = 0

        # ✨ 流程成功，更新執行紀錄的狀態
        execution.status = "SUCCESS"

    except Exception as e:
        logger.error(f"Error syncing connection {connection_id}: {e}", exc_info=True)
        # 更新 Connection 和 Execution 的狀態為錯誤
        connection.status = "ERROR"
        execution.status = "FAILED"
        execution.message = str(e)
        self.retry(exc=e)

    finally:
        # 無論成功或失敗，都將 Connection 狀態從 'SYNCING' 恢復為 'ACTIVE' 或 'ERROR'
        if connection.status == "SYNCING":
            connection.status = "ACTIVE"
        connection.save(update_fields=["status"])

        # 儲存最終的執行紀錄
        execution.finished_at = timezone.now()
        execution.save()

        logger.info(
            f"Execution {execution.pk} for connection {connection_id} finished with status '{execution.status}'."
        )


@shared_task
def schedule_periodic_syncs_task():
    """
    由 Celery Beat 每分鐘執行一次，精確檢查並派發到期的同步任務。
    """
    now = timezone.now()
    logger.info(f"Running periodic sync scheduler at: {now.strftime('%Y-%m-%d %H:%M')}")

    # 找出所有需要定期同步的、處於活動或錯誤狀態的連線
    connections_to_check = Connection.objects.filter(
        is_enabled=True,  # <-- 重要：只選擇已啟用的連線
        status__in=["ACTIVE", "ERROR"],
        config__sync_frequency__in=["daily", "weekly", "monthly"],
        config__has_key="sync_hour",  # 確保 config 中有 sync_hour 才處理 (修正了 has_key)
    )

    for conn in connections_to_check:
        try:
            # 從 config 中讀取使用者設定的時間，並轉換為整數
            sync_hour = int(conn.config.get("sync_hour", 0))
            sync_minute = int(conn.config.get("sync_minute", 0))

            # --- 核心判斷邏輯 ---

            # 1.【時間精確匹配】檢查現在的「時」和「分」是否與設定的完全一致
            if now.hour != sync_hour or now.minute != sync_minute:
                continue  # 時間不對，直接跳過這個連線

            # 2.【防止重複執行】檢查今天是否已經同步過
            #    這很重要，因為此任務現在每分鐘都跑
            if conn.last_sync_time and conn.last_sync_time.date() == now.date():
                continue  # 今天已經同步過了，跳過

            # 3.【頻率日期匹配】檢查今天的日期是否符合 daily/weekly/monthly 的規則
            freq = conn.config.get("sync_frequency")
            should_run = False
            if freq == "daily":
                should_run = True
            elif freq == "weekly":
                # weekday() 回傳：週一=0, 週二=1 ... 週日=6
                # 假設您在 form 中儲存的也是這個格式
                day_of_week = conn.config.get("weekly_day_of_week")
                if str(now.weekday()) == day_of_week:
                    should_run = True
            elif freq == "monthly":
                day_of_month = conn.config.get("monthly_day_of_month")
                if str(now.day) == day_of_month:
                    should_run = True

            # --- 派發任務 ---
            if should_run:
                logger.info(
                    f"Dispatching sync task for connection {conn.pk} as per its '{freq}' schedule at {sync_hour:02}:{sync_minute:02}."
                )
                sync_connection_data_task.delay(conn.pk)

        except (ValueError, TypeError) as e:
            logger.error(
                f"Could not parse schedule for connection {conn.pk}. Config: {conn.config}. Error: {e}"
            )
            continue  # 如果某個連線的 config 格式錯誤，跳過它，不要影響其他任務
