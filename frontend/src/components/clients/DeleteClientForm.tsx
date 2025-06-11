'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/definitions'; // 再次匯入型別

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function DeleteClientForm({ client }: { client: Client }) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isMatch = confirmName === client.name;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsDeleting(true);

    if (!isMatch) {
      setError('Input does not match client name.');
      setIsDeleting(false);
      return;
    }
    
    const csrfToken = getCookie('csrftoken');
    if (!csrfToken) {
      setError('安全驗證 token 找不到，請重新整理頁面。');
      setIsDeleting(false);
      return;
    }
  
    try {
      // 2b. 修改：fetch 請求
      const response = await fetch(`http://localhost:8000/clients/api/${client.id}/`, {
        method: 'DELETE',
        headers: {
          // 2c. 新增：在 Header 中附上 CSRF Token
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        // 2d. 移除：DELETE 請求通常不需要 body
      });

      // 2e. 修改：檢查 204 No Content 狀態碼
      if (response.status === 204) {
        alert('客戶已成功刪除！');
        router.push('/clients');
        router.refresh(); // 確保客戶列表頁面資料更新
      } else {
        const data = await response.json();
        // 顯示從後端傳回的錯誤訊息
        throw new Error(data.detail || '刪除失敗，請稍後再試。');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={handleDelete}>
      <div className="mb-3">
        <label htmlFor="confirmClientName" className="form-label">
          Please type <strong className="text-danger">{client.name}</strong> to confirm.
        </label>
        <input
          type="text"
          className="form-control"
          id="confirmClientName"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
      </div>
      {error && <p className="text-danger">{error}</p>}
      <button 
        type="submit" 
        className="btn btn-danger" 
        disabled={!isMatch || isDeleting}
      >
        {isDeleting ? 'Deleting...' : 'I understand the consequences, delete this client'}
      </button>
    </form>
  );
}