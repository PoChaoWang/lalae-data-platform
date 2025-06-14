// app/components/clients/ClientDetail.tsx
'use client'; // 標記為客戶端元件

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // 用於從 URL 讀取 clientId
import type { Client } from '@/lib/definitions';
import DeleteClientForm from '@/components/clients/DeleteClientForm';

// 從環境變數讀取 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function ClientDetail() {
  // 獲取 URL 中的動態參數 (clientId)
  const params = useParams();
  const clientId = params.clientId as string;

  // 使用 state 管理客戶資料、載入和錯誤狀態
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 如果 clientId 不存在，則不執行 fetch
    if (!clientId) return;

    const fetchClient = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/clients/api/${clientId}/`, {
          credentials: 'include', // 確保請求時攜帶 cookie
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('The client you are looking for does not exist.');
          }
          throw new Error(`Failed to fetch client data: ${response.statusText}`);
        }
        
        const data = await response.json();
        setClient(data);
        
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientId]); // 當 clientId 變化時，重新獲取資料

  // 顯示載入中畫面
  if (loading) {
    return (
      <div className="container mt-4">
        <div className="placeholder-glow">
          <span className="placeholder col-6" style={{ height: '38px' }}></span>
          <hr />
          <span className="placeholder col-8" style={{ height: '24px' }}></span>
          <div className="card mt-3">
            <div className="card-body">
              <span className="placeholder col-12"></span>
              <span className="placeholder col-10"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 顯示錯誤訊息
  if (error || !client) {
    return (
      <div className="container mt-4">
        <h1>An Error Occurred</h1>
        <p>{error || 'The client could not be found.'}</p>
        <Link href="/clients" className="btn btn-primary">Back to Client List</Link>
      </div>
    );
  }

  // 成功獲取資料後，顯示主要內容
  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item"><Link href="/clients">Clients</Link></li>
            <li className="breadcrumb-item active" aria-current="page">{client.name}</li>
          </ol>
        </nav>
      </div>
      
      <h2>{client.name}</h2>
      <hr />
      
      <div className="card mb-4">
        <div className="card-header">Client Details</div>
        <div className="card-body">
          <p><strong>BigQuery Dataset ID:</strong> <code>{client.bigquery_dataset_id}</code></p>
          <p><strong>Status:</strong> 
            <span className={`badge ${client.is_active ? 'bg-success' : 'bg-secondary'}`}>
              {client.is_active ? 'Active' : 'Inactive'}
            </span>
          </p>
          <p className="card-text"><small className="text-muted">Created At: {new Date(client.created_at).toLocaleString()}</small></p>
          <p className="card-text"><small className="text-muted">Created By: {client.created_by}</small></p>
        </div>
      </div>

      <div className="card border-danger">
        <div className="card-header bg-danger text-white">
          Danger Zone
        </div>
        <div className="card-body">
          <h5 className="card-title text-danger">Delete This Client</h5>
          <p className="card-text">Once you delete a client, there is no going back. Please be certain.</p>
          <DeleteClientForm client={client} />
        </div>
      </div>
    </div>
  );
}