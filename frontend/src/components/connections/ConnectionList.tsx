// /components/connections/ConnectionList.tsx
'use client'; // 標記為客戶端元件

import { useState, useEffect } from 'react'; // 匯入 hooks
import { useRouter } from 'next/navigation';
import type { Connection } from '@/lib/definitions';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

export default function ConnectionList() {
  const router = useRouter();
  // ✨ 新增：使用 state 來管理資料、載入狀態和錯誤
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✨ 關鍵：使用 useEffect 在元件掛載後從瀏覽器獲取資料
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/`, {
          // 在客戶端 fetch 中，瀏覽器會自動處理 cookies，不需要手動設定 headers
          credentials: 'include', // 確保跨域請求時會發送 cookie
        });
        if (!res.ok) {
          // 如果是 403，給出更明確的提示
          if (res.status === 403) {
             throw new Error('Authentication failed. Please log in to your Django admin and try again.');
          }
          throw new Error(`Failed to fetch connections: ${res.statusText}`);
        }
        const data = await res.json();
        
        setConnections(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, []); // 空依賴陣列確保此 effect 只在元件首次渲染後執行一次

  // 根據載入和錯誤狀態顯示不同的 UI
  if (loading) return (
    <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead className="table-light">
            <tr>
              <th>Enabled</th><th>Display Name</th><th>Data Source</th>
              <th>Client</th><th>Status</th><th>Target Dataset</th><th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="placeholder-glow">
                  <td><span className="placeholder col-8"></span></td>
                  <td><span className="placeholder col-10"></span></td>
                  <td><span className="placeholder col-6"></span></td>
                  <td><span className="placeholder col-7"></span></td>
                  <td><span className="placeholder col-7"></span></td>
                  <td><span className="placeholder col-7"></span></td>
                  <td><span className="placeholder col-7"></span></td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
  )
  if (error) return <div className="alert alert-danger">{error}</div>;

  if (!connections || connections.length === 0) {
    return <div className="alert alert-info">You currently have no connections.</div>;
  }

  const getStatusBadge = (status: string) => {
      const statusMap: { [key: string]: string } = {
          'ACTIVE': 'bg-success', 'PENDING': 'bg-info text-dark',
          'ERROR': 'bg-danger', 'DISABLED': 'bg-secondary'
      };
      return statusMap[status] || 'bg-light text-dark';
  };

  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover">
        <thead className="table-light">
          <tr>
            <th>Enabled</th><th>Display Name</th><th>Data Source</th>
            <th>Client</th><th>Status</th><th>Target Dataset</th><th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => (
            <tr key={connection.id} onClick={() => router.push(`/connections/${connection.id}`)} style={{ cursor: 'pointer' }}>
              <td><span className={`badge ${connection.is_enabled ? 'bg-success' : 'bg-secondary'}`}>{connection.is_enabled ? 'ON' : 'OFF'}</span></td>
              <td>{connection.display_name}</td><td>{connection.data_source.display_name}</td>
              <td>{connection.client.name}</td><td><span className={`badge ${getStatusBadge(connection.status)}`}>{connection.status}</span></td>
              <td>{connection.target_dataset_id}</td>
              <td>{new Date(connection.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}