// 這個檔案用來定義整個應用程式中會用到的 TypeScript 型別，
// 特別是那些從後端 API 獲取的資料結構。

/**
 * 代表從 Django API 回傳的使用者狀態。
 * 這對應到 AuthContext 中使用的 user 物件。
 */
export type User = {
    isAuthenticated: boolean;
    username?: string;
    email?: string;
};
  
  /**
   * 代表單一客戶 (Client) 的完整資料結構。
   * 這個型別的欄位應該要和你 Django client_api 回傳的 JSON 中的 key 完全對應。
   */
export type Client = {
    id: string; // 在 Django 中是 UUID，但在 JSON 中會是字串
    name: string;
    description: string | null; // 描述可能是選填的，所以可以是 null
    is_active: boolean;
    bigquery_dataset_id: string; // BigQuery ID 可能在建立初期是 null
    created_at: string; // 在 JSON 中，DateTime 物件會被序列化成 ISO 格式的字串
    created_by: string; // 建立者的 username，可能為 null
    updated_at: string | null; // ISO 格式的字串
    };
  
export type SelectableClient = {
  id: string;
  name: string;
  bigquery_dataset_id: string;
  facebook_social_account: SocialAccountInfo | null;
  google_social_account: SocialAccountInfo | null;
};

export type SocialAccountInfo = {
  id: number;
  provider: string;
  uid: string;
  name: string;
  email: string;
};
  

export type DataSource = {
  id: number;
  name: string;
  display_name: string;
};


export type Connection = {
  id: number;
  is_enabled: boolean;
  display_name: string;
  data_source: DataSource; // 巢狀使用 DataSource 型別
  client: { 
    id: string;
    name: string; 
  };
  status: string;
  target_dataset_id: string;
  updated_at: string;
  last_execution_status: string | null;
  last_execution_time: string | null;
  config: any; // 在真實應用中可以為不同的 config 定義更精確的型別
};

export type SchemaColumn = {
  name: string;
  type: string;
};

export type FormState = {
  sheet_id: string;
  tab_name: string;
  schema: SchemaColumn[];
  date_column: string | null;
};

export interface TriggeredBy {
  id: number;
  username: string;
  email: string;
}

export interface ConnectionExecution {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'PENDING';
  message: string;
  config: any; // 可以是一個 JSON 物件
  triggered_by: TriggeredBy | null; // 可能為 null，代表系統觸發 (Celery Beat)
}


export type QueryDefinition = {
  id: number;
  name: string;
  description: string | null;
  sql_query: string;
  bigquery_project_id: string;
  bigquery_dataset_id: string;
  schedule_type: 'ONCE' | 'PERIODIC'; 
  cron_schedule: string | null; 
  output_target: 'NONE' | 'GOOGLE_SHEET' | 'LOOKER_STUDIO'; 
  output_config: any | null;
  last_run_status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SCHEDULED' | 'OUTPUT_ERROR' | 'SAVED_ONLY'; // 對應 Django 的 STATUS_CHOICES
  last_run_initiated_at: string | null; 
  last_successful_run_result: {
    id: number;
    status: string; 
    executed_at: string; 
    result_data_csv: string | null; 
    error_message: string | null; 
  } | null;
  last_successful_test_hash: string | null; 
  last_tested_at: string | null; 
  owner_id: number | null; 
  created_at: string; 
  updated_at: string; 
  has_downloadable_result: boolean; 
  latest_execution_time?: string | null; 
  latest_status?: string; 
};

export type QueryRunResult = {
  id: number;
  query: number; 
  executed_at: string; 
  completed_at: string | null; 
  status: string; 
  result_rows_count: number | null;
  result_data_csv: string | null;
  error_message: string | null;
  triggered_by: string; 
  result_output_link: string | null; 
  result_message: string | null;
  result_storage_path: string | null;
};
export type ClientInfo = Pick<Client, 'id' | 'name' | 'bigquery_dataset_id'>;

export type QueryListResponse = {
  count: number; 
  next: string | null; 
  previous: string | null; 
  results: QueryDefinition[]; 
  current_dataset: string;
  client_datasets: ClientInfo[];
  current_client_name: string;
  current_access_level: string;
};

export type QueryExecutionHistoryResponse = {
  status: 'success' | 'error';
  executions: QueryRunResult[];
  message?: string;
};

export type RerunQueryResponse = {
  status: 'success' | 'error';
  message: string;
};