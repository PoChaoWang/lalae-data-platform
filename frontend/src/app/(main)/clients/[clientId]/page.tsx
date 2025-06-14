// app/(routes)/clients/[clientId]/page.tsx
import ProtectedComponent from '@/components/ProtectedComponent';
import ClientDetail from '@/components/clients/ClientDetail';

/**
 * 客戶詳情頁的進入點。
 * 它只負責頁面佈局和渲染客戶端元件。
 */
export default function ClientDetailPage() {
  return (
    <ProtectedComponent>
      {/* 渲染 ClientDetail 元件，它會自己處理資料獲取和狀態顯示 */}
      <ClientDetail />
    </ProtectedComponent>
  );
}