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
    bigquery_dataset_id: string | null; // BigQuery ID 可能在建立初期是 null
    created_at: string; // 在 JSON 中，DateTime 物件會被序列化成 ISO 格式的字串
    created_by__username: string | null; // 建立者的 username，可能為 null
    updated_at: string | null; // ISO 格式的字串
    };
  
  // 你也可以為其他 App (例如 Queries, Connections) 在這裡定義它們的型別
  // export type Query = { ... };
  // export type Connection = { ... };
  
  