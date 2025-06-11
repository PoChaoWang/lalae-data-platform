'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 一個用來讀取 cookie 的輔助函式。
 * @param name - 要讀取的 cookie 名稱 (例如 'csrftoken')
 * @returns string | null - 回傳 cookie 的值，或在找不到時回傳 null。
 */
function getCookie(name: string): string | null {
  // 這個函式只能在瀏覽器環境中執行
  if (typeof document === 'undefined') {
    return null;
  }
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    // 取得 cookie 值並回傳
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}


export default function NewClientPage() {
  const router = useRouter();
  
  // 表單欄位的狀態
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  // 處理中狀態
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // +++ 統一的錯誤狀態管理 +++
  // errors 是一個物件，key 是欄位名稱，value 是該欄位的錯誤訊息陣列
  const [errors, setErrors] = useState<Record<string, any>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({}); // 提交前先清除舊的錯誤訊息

    const csrfToken = getCookie('csrftoken');

    if (!csrfToken) {
      setErrors({ non_field_errors: ['Sercurity token not found. Please login again'] });
      setIsSubmitting(false);
      return;
    }

    const response = await fetch('http://localhost:8000/clients/api/', {
      method: 'POST',
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
      alert('Client created successfully');
      router.push('/clients');
      router.refresh();
    } else {
      const errorData = await response.json();
      
      // +++ 統一的錯誤處理邏輯 +++
      if (typeof errorData === 'object' && errorData !== null) {
        setErrors(errorData);
      } else {
        setErrors({ non_field_errors: [ 'Unexpected error occurred' ] });
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Create New Client</h1>
        <Link href="/clients" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left"></i> Back to Client List
        </Link>
      </div>

      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <form onSubmit={handleSubmit} noValidate>
                {/* 顯示全域錯誤 (例如 CSRF 或伺服器內部錯誤) */}
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
                      {/* +++ 為 err 加上 string 類型 +++ */}
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
                    {isSubmitting ? 'Submitting...' : 'Create Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
