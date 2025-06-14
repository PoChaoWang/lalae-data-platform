// app/components/clients/ClientForm.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Client } from '@/lib/definitions';

// 輔助函式：從瀏覽器讀取 CSRF token
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// 定義元件的 props 型別
interface ClientFormProps {
  initialData?: Client | null; // 用於編輯模式，可選
  onSuccess: () => void; // 成功提交後的回呼函式
}

export default function ClientForm({ initialData = null, onSuccess }: ClientFormProps) {
  // 表單欄位狀態
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  // 處理中及錯誤狀態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, any>>({});

  // Effect Hook: 如果有 initialData (編輯模式)，則填入表單預設值
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setIsActive(initialData.is_active);
    }
  }, [initialData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const csrfToken = getCookie('csrftoken');
    if (!csrfToken) {
      setErrors({ non_field_errors: ['Security token not found. Please refresh and try again.'] });
      setIsSubmitting(false);
      return;
    }

    // 根據是否為編輯模式，決定 API URL 和 HTTP 方法
    const isEditMode = initialData !== null;
    const apiUrl = isEditMode
      ? `http://localhost:8000/clients/api/${initialData.id}/`
      : 'http://localhost:8000/clients/api/';
    const method = isEditMode ? 'PUT' : 'POST';

    const response = await fetch(apiUrl, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({
        name,
        is_active: isActive,
      }),
    });

    if (response.ok) {
      // 成功後，調用從 props 傳入的 onSuccess 回呼函式
      onSuccess();
    } else {
      const errorData = await response.json();
      if (typeof errorData === 'object' && errorData !== null) {
        setErrors(errorData);
      } else {
        setErrors({ non_field_errors: ['An unexpected error occurred.'] });
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <form onSubmit={handleSubmit} noValidate>
          {/* 顯示全域錯誤 */}
          {errors.non_field_errors && (
            <div className="alert alert-danger">
              {Array.isArray(errors.non_field_errors) ? errors.non_field_errors.map((err: string, i: number) => <p key={i} className="mb-0">{err}</p>) : <p>{errors.non_field_errors}</p>}
            </div>
          )}
          {errors.detail && (
            <div className="alert alert-danger">{errors.detail}</div>
          )}

          {/* 客戶名稱欄位 */}
          <div className="mb-3">
            <label htmlFor="name" className="form-label">Client Name</label>
            <input
              type="text"
              className={`form-control ${errors.name ? 'is-invalid' : ''}`}
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
            {errors.name && (
              <div className="invalid-feedback">
                {errors.name.map((err: string, i: number) => <p key={i} className="mb-0">{err}</p>)}
              </div>
            )}
          </div>

          {/* 啟用狀態 */}
          <div className="mb-3">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
              />
              <label className="form-check-label" htmlFor="isActive">Is Active</label>
            </div>
          </div>

          <div className="d-grid gap-2">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : (initialData ? 'Update Client' : 'Create Client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}