// app/(routes)/clients/page.tsx
import Link from 'next/link';
import ProtectedComponent from '@/components/ProtectedComponent';
import ClientList from '@/components/clients/ClientList'; // 匯入我們新的客戶端元件

/**
 * 客戶列表頁面的主要進入點。
 * 這個元件現在只負責頁面佈局。
 */
export default function ClientsPage() {
  return (
    <ProtectedComponent>
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>Clients</h1>
          <Link href="/clients/new" className="btn btn-primary">
            <i className="fas fa-plus me-2"></i> New Client
          </Link>
        </div>

        {/* 在這裡渲染客戶端元件，它會自己處理資料獲取 */}
        <ClientList />
        
      </div>
    </ProtectedComponent>
  );
}