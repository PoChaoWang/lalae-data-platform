// /app/(main)/queries/page.tsx
"use client";

import ProtectedComponent from '@/components/ProtectedComponent';
import QueryList from '@/components/queries/QueryList';
import Link from 'next/link';
import { DatabaseZap, Plus } from 'lucide-react'; // 匯入圖示
import { Button } from '@/components/ui/button'; // 匯入 Button 元件

export default function QueriesPage() {

  return (
    <ProtectedComponent>
      <div className="mx-auto max-w-[120rem] px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/25">
              <DatabaseZap className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent">
                Queries
              </h1>
              <p className="text-gray-400 mt-1">Manage your queries</p>
            </div>
          </div>

          <Link href="/queries/new">
            <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-6 py-3 rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105">
              <Plus className="w-5 h-5 mr-2" />
              Create New Queries
            </Button>
          </Link>
        </div>
        
        <QueryList />
      </div>
    </ProtectedComponent>
  );
}