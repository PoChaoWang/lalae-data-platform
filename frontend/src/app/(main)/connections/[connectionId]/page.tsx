// /frontend/src/app/connections/[connectionId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCookie } from '@/lib/utils';
import CloneConnectionButton from '@/components/connections/CloneConnectionButton'; 
import DeleteConnectionModal from '@/components/connections/DeleteConnectionModal';
import { Connection } from '@/lib/definitions';

// 假設後端 URL 在環境變數中
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;



export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connectionId;
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // 1. 擴充 State 來管理整個表單
  const [isEnabled, setIsEnabled] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState('daily');
  const [syncHour, setSyncHour] = useState('00');
  const [syncMinute, setSyncMinute] = useState('00');
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState('1');
  const [monthlyDayOfMonth, setMonthlyDayOfMonth] = useState(1);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!connectionId) return;

    const fetchDataAndToken = async () => {
      setLoading(true);
      setError(null); // 在開始請求前重置錯誤狀態

      try {
        // ✨ 使用 Promise.all 同時發起兩個請求
        const [connRes, csrfRes] = await Promise.all([
          fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/`, { credentials: 'include' }),
          fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/get-csrf-token/`, { credentials: 'include' })
        ]);

        if (!connRes.ok) throw new Error('Failed to fetch connection details.');
        if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token.');

        const connData: Connection = await connRes.json();
        const csrfData = await csrfRes.json();

        // 設定連線資料
        setConnection(connData);
        // ✨ 將從 API 獲取的 Token 存入 state
        setCsrfToken(csrfData.csrfToken); 

        // 初始化表單 state (這部分不變)
        setIsEnabled(connData.is_enabled);
        setSyncFrequency(connData.config?.sync_frequency || 'daily');
        setSyncHour(connData.config?.sync_hour || '00');
        setSyncMinute(connData.config?.sync_minute || '00');
        setWeeklyDayOfWeek(connData.config?.weekly_day_of_week || '1');
        setMonthlyDayOfMonth(connData.config?.monthly_day_of_month || 1);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDataAndToken();
  }, [connectionId]);

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMessage(null);

    if (!csrfToken) {
      setUpdateMessage({ type: 'error', text: 'Security token is missing. Cannot update.' });
      return;
    }

    const payload = {
      is_enabled: isEnabled,
      config: {
        ...connection?.config, // 保留現有的 config
        sync_frequency: syncFrequency,
        sync_hour: syncHour,
        sync_minute: syncMinute,
        weekly_day_of_week: weeklyDayOfWeek,
        monthly_day_of_month: monthlyDayOfMonth,
      }
    };
    
    // Django REST Framework 的 ModelViewSet 預設就支援 PATCH
    try {
      const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData) || 'Failed to update connection.');
      }

      const updatedConnection = await res.json();
      setConnection(updatedConnection); // 更新頁面上的資料
      setUpdateMessage({ type: 'success', text: 'Connection updated successfully!' });

    } catch (err: any) {
      setUpdateMessage({ type: 'error', text: err.message });
    }
  };
  

  if (loading) return <div className="container my-4">Loading...</div>;
  if (error) return <div className="container my-4 alert alert-danger">{error}</div>;
  if (!connection) return <div className="container my-4">Connection not found.</div>;

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-0">Connection Details</h1>
          <p className="text-muted mb-0">{connection.display_name}</p>
        </div>
        <Link href="/connections" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left"></i> Back to List
        </Link>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">{connection.data_source.display_name} Connection</h5>
        </div>
        <div className="card-body">
          <dl className="row">
            <dt className="col-sm-3">Display Name</dt>
            <dd className="col-sm-9">{connection.display_name}</dd>

            <dt className="col-sm-3">Data Source</dt>
            <dd className="col-sm-9">{connection.data_source.display_name}</dd>

            <dt className="col-sm-3">Status</dt>
            <dd className="col-sm-9"><span className={`badge bg-${connection.status === 'ACTIVE' ? 'success' : 'secondary'}`}>{connection.status}</span></dd>

            <dt className="col-sm-3">BigQuery Dataset ID</dt>
            <dd className="col-sm-9">{connection.target_dataset_id}</dd>
            
            {/* 根據需要添加更多詳情 */}

            <dt className="col-sm-3">Full Configuration</dt>
            <dd className="col-sm-9">
              <details>
                <summary style={{ cursor: 'pointer', color: '#0d6efd' }}>Click to expand</summary>
                <pre className="bg-light p-2 border rounded mt-2">
                  <code>{JSON.stringify(connection.config, null, 2)}</code>
                </pre>
              </details>
            </dd>
          </dl>
        </div>
      </div>

      {/* 更新表單 */}
      <div className="card mb-4">
        <div className="card-header">
            <h5 className="mb-0">Update Sync Schedule & Status</h5>
        </div>
        <div className="card-body">
            {updateMessage && (
                <div className={`alert alert-${updateMessage.type}`}>
                    {updateMessage.text}
                </div>
            )}
            <form onSubmit={handleUpdateSchedule}>
                <div className="form-check form-switch form-control-lg mb-4">
                    <input className="form-check-input" type="checkbox" role="switch" id="id_is_enabled" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} />
                    <label className="form-check-label" htmlFor="id_is_enabled">
                        Connection Status: <span className={`badge ${isEnabled ? 'bg-success' : 'bg-secondary'}`}>{isEnabled ? 'ON' : 'OFF'}</span>
                    </label>
                    <div className="form-text">If disabled(OFF), this connection will not be synced the data to BigQuery.</div>
                </div>

                {/* 2. 建立完整的表單 JSX */}
                <div className="row align-items-end">
                    <div className="col-md-3 mb-3">
                        <label htmlFor="sync_frequency" className="form-label">Sync Frequency</label>
                        <select id="sync_frequency" value={syncFrequency} onChange={e => setSyncFrequency(e.target.value)} className="form-select">
                            <option value="once">Once</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div className="col-md-3 mb-3">
                        <label htmlFor="sync_hour" className="form-label">Hour (24h)</label>
                        <select id="sync_hour" value={syncHour} onChange={e => setSyncHour(e.target.value)} className="form-select">
                            {[...Array(24).keys()].map(h => <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3 mb-3">
                        <label htmlFor="sync_minute" className="form-label">Minute</label>
                        <select id="sync_minute" value={syncMinute} onChange={e => setSyncMinute(e.target.value)} className="form-select">
                            <option value="00">00</option><option value="15">15</option>
                            <option value="30">30</option><option value="45">45</option>
                        </select>
                    </div>
                </div>

                {/* 根據 syncFrequency 條件性顯示 */}
                {syncFrequency === 'weekly' && (
                    <div className="mb-3">
                        <label htmlFor="weekly_day_of_week" className="form-label">Day of Week</label>
                        <select id="weekly_day_of_week" value={weeklyDayOfWeek} onChange={e => setWeeklyDayOfWeek(e.target.value)} className="form-select" style={{maxWidth: '250px'}}>
                            <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option>
                            <option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option>
                            <option value="0">Sunday</option>
                        </select>
                    </div>
                )}

                {syncFrequency === 'monthly' && (
                    <div className="mb-3">
                        <label htmlFor="monthly_day_of_month" className="form-label">Day of Month</label>
                        <input id="monthly_day_of_month" type="number" min="1" max="31" value={monthlyDayOfMonth} onChange={e => setMonthlyDayOfMonth(parseInt(e.target.value, 10))} className="form-control" style={{maxWidth: '250px'}} />
                    </div>
                )}

                <button type="submit" className="btn btn-success">
                    <i className="bi bi-save"></i> Update
                </button>
            </form>
        </div>
      </div>

      <div className="d-flex justify-content-end gap-2 mt-4">
        {/* 直接使用 Clone 按鈕，傳入 connectionId */}
        <CloneConnectionButton connectionId={connection.id} />
        
        {/* 這個按鈕只負責打開 Modal */}
        <button onClick={() => setIsDeleteModalOpen(true)} className="btn btn-danger">
            <i className="bi bi-trash"></i> Delete Connection
        </button>
      </div>

      {/* 將 Modal 元件放在這裡。它在 isOpen=false 時不會顯示任何東西 */}
      <DeleteConnectionModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)}
        connectionId={connection.id}
        connectionName={connection.display_name}
        csrfToken={csrfToken}
      />

    </div>
  );
}