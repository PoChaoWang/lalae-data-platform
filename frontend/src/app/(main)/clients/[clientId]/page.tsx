import { cookies } from 'next/headers';
import Link from 'next/link';
import { Client } from '@/lib/definitions'; // 匯入你的 Client 型別
import DeleteClientForm from '@/components/clients/DeleteClientForm'; // 匯入我們即將建立的刪除元件
import ProtectedComponent from '@/components/ProtectedComponent'; 

// 獲取單一客戶資料的函式
async function getClient(id: string): Promise<Client | null> {
  const sessionid = cookies().get('sessionid')?.value;
  if (!sessionid) return null;

  // 注意 API URL 的變化
  const response = await fetch(`http://localhost:8000/clients/api/${id}/`, {
    headers: { 'Cookie': `sessionid=${sessionid}` },
    cache: 'no-store', // 詳情頁建議不快取，以獲取最新資訊
  });

  if (!response.ok) return null;
  return response.json();
}

// 詳情頁元件
export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const client = await getClient(params.clientId);

  if (!client) {
    return (
      <div className="container mt-4">
        <h1>The Client Does Not Exist</h1>
        <p>The client you are looking for does not exist.</p>
        <Link href="/clients" className="btn btn-primary">Back to Client List</Link>
      </div>
    );
  }
  console.log(client);
  return (
    <ProtectedComponent>
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          {/* 麵包屑導覽 */}
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link href="/clients">Clients</Link></li>
              <li className="breadcrumb-item active" aria-current="page">{client.name}</li>
            </ol>
          </nav>
          {/* ★ 未來可以放「編輯」按鈕的地方 ★ */}
          {/* <Link href={`/clients/${client.id}/edit`} className="btn btn-outline-secondary">編輯</Link> */}
        </div>
        
        <h2>{client.name}</h2>
        <hr />
        
        {/* 顯示客戶詳細資訊 */}
        <div className="card mb-4">
          <div className="card-header">Client Details</div>
          <div className="card-body">
            <p><strong>BigQuery Dataset ID:</strong> <code>{client.bigquery_dataset_id}</code></p>
            <p><strong>Status:</strong> 
              <span className={`badge ${client.is_active ? 'bg-success' : 'bg-secondary'}`}>
                {client.is_active ? 'Active' : 'Inactive'}
              </span>
            </p>
            <p className="card-text"><small className="text-muted">Created At: {client.created_at}</small></p>
            <p className="card-text"><small className="text-muted">Created By: {client.created_by__username} </small></p>
          </div>
        </div>

        {/* 危險操作區域：刪除元件 */}
        <div className="card border-danger">
          <div className="card-header bg-danger text-white">
            Danger Zone
          </div>
          <div className="card-body">
            <h5 className="card-title text-danger">Delete</h5>
            <p className="card-text">All data associated with this client will be permanently deleted.</p>
            {/* 傳遞 client 物件給刪除元件 */}
            <DeleteClientForm client={client} />
          </div>
        </div>
      </div>
    </ProtectedComponent>
  );
}
