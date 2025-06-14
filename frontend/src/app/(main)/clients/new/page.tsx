// app/(routes)/clients/new/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedComponent from '@/components/ProtectedComponent';
import ClientForm from '@/components/clients/ClientForm'; // 匯入我們新的表單元件

export default function NewClientPage() {
  const router = useRouter();

  // 定義一個處理成功提交的函式
  // 這個函式會被傳遞給 ClientForm 的 onSuccess prop
  const handleSuccess = () => {
    alert('Client created successfully!');
    // 導向到客戶列表頁，並刷新頁面資料
    router.push('/clients');
    router.refresh(); 
  };

  return (
    <ProtectedComponent>
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>Create New Client</h1>
          <Link href="/clients" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-left"></i> Back to Client List
          </Link>
        </div>

        <div className="row justify-content-center">
          <div className="col-md-8">
            {/* 渲染表單元件，並傳入 onSuccess 處理函式 */}
            <ClientForm onSuccess={handleSuccess} />
          </div>
        </div>
      </div>
    </ProtectedComponent>
  );
}