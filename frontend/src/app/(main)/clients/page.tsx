// app/(routes)/clients/page.tsx
import Link from 'next/link';
import ProtectedComponent from '@/components/ProtectedComponent';
import ClientList from '@/components/clients/ClientList'; // 匯入我們新的客戶端元件
import { Button } from "@/components/ui/button"; // 為了樣式而匯入
import { Plus, Users } from "lucide-react"; // 為了圖示而匯入

/**
 * 客戶列表頁面的主要進入點。
 * 這個元件現在負責頁面佈局、標題和主要操作按鈕。
 */
export default function ClientsPage() {
  return (
    <ProtectedComponent>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <Users className="w-6 h-6 text-black" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent">Clients</h1>
                    <p className="text-gray-400 mt-1">Manage your client data and connections</p>
                </div>
            </div>
            <Link href="/clients/new">
              <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-6 py-3 rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 relative overflow-hidden group">
                  <span className="relative z-10 flex items-center space-x-2">
                      <Plus className="w-5 h-5" />
                      <span>Create New Client</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 bg-orange-500 animate-pulse opacity-20" />
              </Button>
            </Link>
        </div>
        
        <ClientList />
      </div>
    </ProtectedComponent>
  );
}
