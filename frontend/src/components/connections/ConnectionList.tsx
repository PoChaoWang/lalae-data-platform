// /components/connections/ConnectionList.tsx
'use client'; // 標記為客戶端元件

import { useState, useEffect, Fragment } from 'react'; // 匯入 hooks
import { useRouter } from 'next/navigation';
import type { Connection, ConnectionExecution } from '@/lib/definitions';
import { BsChevronDown, BsChevronUp } from 'react-icons/bs';

import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';


// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

export default function ConnectionList() {
  const router = useRouter();
  // ✨ 新增：使用 state 來管理資料、載入狀態和錯誤
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  const [expandedConnectionId, setExpandedConnectionId] = useState<number | null>(null);
  const [history, setHistory] = useState<ConnectionExecution[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);


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

  const handleToggleExpand = async (connectionId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // 防止觸發整行的點擊事件 (跳轉頁面)

    // 如果點擊的是已經展開的行，則收合它
    if (expandedConnectionId === connectionId) {
      setExpandedConnectionId(null);
      return;
    }

    // 展開新的一行
    setExpandedConnectionId(connectionId);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistory([]);

    try {
      const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/executions/`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      setHistory(await res.json());
    } catch (err: any) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 您的 getStatusBadge 函式 (已修改以支援兩種狀態)
  const getStatusBadge = (status: string, type: 'connection' | 'execution'): string => {
    // 連線主列表的狀態顏色
    const connectionMap: { [key: string]: string } = {
        'ACTIVE': 'success', 
        'PENDING': 'info',
        'ERROR': 'danger', 
        'DISABLED': 'secondary'
    };
    // 執行紀錄的狀態顏色
    const executionMap: { [key: string]: string } = {
        'SUCCESS': 'success', 
        'RUNNING': 'primary',
        'FAILED': 'danger', 
        'PENDING': 'info',
    };
    
    const map = type === 'connection' ? connectionMap : executionMap;
    return map[status] || 'light'; // 回傳 'light' 作為預設顏色
};

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

  const colCount = 8;

  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover">
        <thead className="table-light">
          <tr>
            <th>Enabled</th><th>Display Name</th><th>Data Source</th>
            <th>Client</th><th>Status</th><th>Target Dataset</th><th>Last Updated</th>
            <th className="text-center">History</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => (
            <Fragment key={connection.id}>
              <tr onClick={() => router.push(`/connections/${connection.id}`)} style={{ cursor: 'pointer' }}>
                <td><Badge bg={connection.is_enabled ? 'success' : 'secondary'}>{connection.is_enabled ? 'ON' : 'OFF'}</Badge></td>
                <td>{connection.display_name}</td><td>{connection.data_source.display_name}</td>
                <td>{connection.client.name}</td><td><Badge bg={getStatusBadge(connection.status, 'connection')}>{connection.status}</Badge></td>
                <td>{connection.target_dataset_id}</td>
                <td>{new Date(connection.updated_at).toLocaleString()}</td>
                <td className="text-center">
                   <button 
                     className="btn btn-sm btn-outline-secondary"
                     onClick={(e) => handleToggleExpand(connection.id, e)}
                     title={expandedConnectionId === connection.id ? "Collapse history" : "Expand history"}
                   >
                     {expandedConnectionId === connection.id ? <BsChevronUp /> : <BsChevronDown />}
                   </button>
                </td>
              </tr>
              
              {/* --- ✨ 這裡是動態展開的內容 --- */}
              {expandedConnectionId === connection.id && (
                <tr className="connection-expansion-row">
                  <td colSpan={colCount} className="p-3" style={{backgroundColor: '#f8f9fa'}}>
                      {historyLoading && <div className="text-center"><Spinner animation="border" size="sm" /> Loading history...</div>}
                      
                      {historyError && <Alert variant="danger"><strong>Error:</strong> {historyError}</Alert>}

                      {!historyLoading && !historyError && (
                        history.length === 0 ? (
                          <div className="text-center text-muted">No execution history found.</div>
                        ) : (
                          <table className="table table-sm table-bordered mb-0">
                            <thead className="table-secondary">
                              <tr>
                                <th>Status</th><th>Started At</th><th>Finished At</th>
                                <th>Executed By</th><th style={{width: '30%'}}>Message</th><th>Config</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.map(exec => (
                                <tr key={exec.id}>
                                  <td><Badge pill className="w-100" bg={getStatusBadge(exec.status, 'execution')}>{exec.status}</Badge></td>
                                  <td>{new Date(exec.started_at).toLocaleString()}</td>
                                  <td>{exec.finished_at ? new Date(exec.finished_at).toLocaleString() : 'N/A'}</td>
                                  <td>{exec.triggered_by ? exec.triggered_by.username : <span className="text-muted">Scheduled Task</span>}</td>
                                  <td style={{ wordBreak: 'break-word' }}>{exec.message || <span className="text-muted">-</span>}</td>
                                  <td>
                                    <details>
                                      <summary style={{ cursor: 'pointer' }}>View</summary>
                                      <pre className="bg-light p-2 rounded mt-1" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                        {JSON.stringify(exec.config, null, 2)}
                                      </pre>
                                    </details>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}