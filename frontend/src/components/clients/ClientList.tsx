// app/components/clients/ClientList.tsx
'use client'; // ★ 關鍵第一步：標記為客戶端元件

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Client } from '@/lib/definitions'; // 確保 Client 型別的路徑正確

// 從環境變數讀取 URL
const API_URL = `${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/clients/api/`;

export default function ClientList() {
  // 使用 state 來管理資料、載入狀態和錯誤
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 在 effect 中定義非同步函式來獲取資料
    const fetchClients = async () => {
      try {
        const response = await fetch(API_URL, {
          // ★ 關鍵第二步：確保瀏覽器在跨域請求時攜帶 cookie
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 403 || response.status === 401) {
            throw new Error('驗證失敗，請確認您已登入。');
          }
          throw new Error(`獲取資料失敗: ${response.statusText}`);
        }

        const data = await response.json();

        // 處理 Django Rest Framework 的分頁回應
        if (data && Array.isArray(data.results)) {
          setClients(data.results);
        } else if (Array.isArray(data)) {
          setClients(data);
        } else {
          console.warn('API 回應格式非預期:', data);
          setClients([]);
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []); // 空依賴陣列確保只在元件首次渲染後執行一次

  // 根據載入狀態顯示骨架屏 (Placeholder)
  if (loading) {
    return (
      <div className="table-responsive">
        <table className="table table-striped">
          <thead className="table-dark">
            <tr>
              <th>Name</th><th>BigQuery Dataset ID</th><th>Status</th><th>Created</th><th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {/* 產生 5 個佔位行 */}
            {Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="placeholder-glow">
                  <td><span className="placeholder col-10"></span></td>
                  <td><span className="placeholder col-8"></span></td>
                  <td><span className="placeholder col-6"></span></td>
                  <td><span className="placeholder col-7"></span></td>
                  <td><span className="placeholder col-7"></span></td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // 顯示錯誤訊息
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  // ★ 主要的 JSX 內容，與你原本的 page.tsx 相同
  return (
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
                <td>{client.created_at ? new Date(client.created_at).toLocaleDateString() : '-'}</td>
                <td>{client.created_by || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}