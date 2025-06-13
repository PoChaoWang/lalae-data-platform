// /app/(main)/connections/page.tsx
import ProtectedComponent from '@/components/ProtectedComponent'; 
import ConnectionList from '@/components/connections/ConnectionList';
import Link from 'next/link';

// ✨ 修正：頁面元件本身不再獲取資料，只負責佈局和渲染客戶端元件
export default function ConnectionsPage() {
  return (
    <ProtectedComponent>
        <div className="container">
        <div className="d-flex justify-content-between align-items-center content-header">
            <h1>My Connections</h1>
            <Link href="/connections/new" className="btn btn-primary">Add Connection</Link>
        </div>
        {/* 將資料獲取的任務交給 ConnectionList 元件 */}
        <ConnectionList />
        </div>
    </ProtectedComponent>
    
  );
}