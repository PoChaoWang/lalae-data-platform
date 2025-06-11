import Link from 'next/link';
import { cookies } from 'next/headers';
import { Client } from '@/lib/definitions';

/**
 * 這是一個在伺服器端執行的非同步函式，專門用來獲取客戶列表。
 * @returns Promise<Client[]> - 回傳一個包含客戶資料的陣列 Promise。
 */
async function getClients(): Promise<Client[]> {
  const cookieStore = cookies();
  const sessionid = cookieStore.get('sessionid')?.value;

  if (!sessionid) {
    console.log('No sessionid found, user is not authenticated.');
    return [];
  }

  try {
    // 呼叫 Django API (URL 根據你的設定是正確的)
    const response = await fetch('http://localhost:8000/clients/api/', {
      headers: {
        'Cookie': `sessionid=${sessionid}`
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // 如果請求失敗，印出詳細錯誤並回傳空陣列
      console.error(`Failed to fetch clients: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      throw new Error(`Failed to fetch clients: ${response.statusText}`);
    }

    const data = await response.json();

    // 關鍵修正：檢查 DRF 是否使用了分頁。
    // 如果是，真正的陣列在 'results' 屬性中。
    if (data && Array.isArray(data.results)) {
      return data.results as Client[];
    }

    // 如果 API 回傳的直接就是一個陣列 (沒有分頁的情況)
    if (Array.isArray(data)) {
      return data as Client[];
    }
    
    // 如果格式不符預期，印出警告並回傳空陣列以避免前端崩潰
    console.warn('API response is not in the expected format (array or paginated results):', data);
    return [];

  } catch (error) {
    console.error('Error in getClients function:', error);
    // 發生任何錯誤都回傳空陣列，防止頁面崩潰
    return [];
  }
}

/**
 * 客戶列表頁面的主要元件。
 */
export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Clients</h1>
        <Link href="/clients/new" className="btn btn-primary">
          <i className="fas fa-plus me-2"></i> New Client
        </Link>
      </div>
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead className="table-dark">
            <tr>
              <th>Name</th>
              <th>BigQuery Dataset ID</th>
              <th>Status</th>
              <th>Created</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {/* 這裡現在是安全的，因為 getClients 保證回傳陣列 */}
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4">No clients found.</td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <Link href={`/clients/${client.id}`} className="fw-bold text-decoration-none">
                      {client.name}
                    </Link>
                  </td>
                  <td><code>{client.bigquery_dataset_id || '-'}</code></td>
                  <td>
                    <span className={`badge ${client.is_active ? 'bg-success' : 'bg-secondary'}`}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {/* 使用 client.created_at，並確保它是有效的日期字串 */}
                  <td>{client.created_at ? new Date(client.created_at).toLocaleDateString() : '-'}</td>
                  {/* 關鍵修正：使用 client.created_by 來顯示名稱 */}
                  <td>{client.created_by || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
