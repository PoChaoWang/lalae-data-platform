// frontend/src/app/(main)/queries/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QueryDefinition } from '@/lib/definitions';
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';
import ProtectedComponent from '@/components/ProtectedComponent';
import QueryForm from '@/components/queries/QueryForm';
import DeleteQueryModal from '@/components/queries/DeleteQueryModal';
import { Button } from '@/components/ui/button';
import { Trash2, AlertCircle } from 'lucide-react';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

interface QueryDetailsPageProps {
  queryId?: number | null;
}

export default function QueryDetailsPage({ queryId: propQueryId }: QueryDetailsPageProps) {
  const params = useParams();
  const router = useRouter();
  const queryId = typeof params.queryId === 'string' ? parseInt(params.queryId, 10) : null;

  const { protectedFetch } = useProtectedFetch();
  const [queryData, setQueryData] = useState<QueryDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    const fetchQuery = async () => {
      if (!queryId || !protectedFetch) {
        setIsLoading(false);
        setError("Query ID is missing or authentication is not ready.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const queryRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/${queryId}/`);
        if (!queryRes.ok) {
          const errorData = await queryRes.json();
          throw new Error(errorData.detail || 'Failed to fetch query.');
        }
        const fetchedQuery: QueryDefinition = await queryRes.json();
        setQueryData(fetchedQuery);

      } catch (err: any) {
        console.error("Occurred error:", err);
        setError(err.message || 'Unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuery();
  }, [queryId, protectedFetch]);

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    router.push('/queries');
  };

  if (isLoading) {
    return null; // 或者返回一個非常小的 div 等，避免觸發其他渲染邏輯
  }


  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-gray-900 text-red-400">
        <div className="flex flex-col items-center space-y-4">
          <AlertCircle className="w-12 h-12" />
          <p className="text-lg">Error：{error}</p>
          <Button onClick={() => router.push('/queries')} className="mt-4 bg-orange-500 hover:bg-orange-600 text-black">
            Back to Queries
          </Button>
        </div>
      </div>
    );
  }

  if (!queryData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-gray-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <AlertCircle className="w-12 h-12 text-yellow-400" />
          <p className="text-lg">Unable to find query.</p>
          <Button onClick={() => router.push('/queries')} className="mt-4 bg-orange-500 hover:bg-orange-600 text-black">
            Back to Queries
          </Button>
        </div>
      </div>
    );
  }

  // 構造 clientForForm，確保有 id, name, bigquery_dataset_id
  // 這裡使用 bigquery_dataset_id 作為 name 的替代，因為 QueryDefinition 中沒有 client_name
  const clientForForm = {
    id: queryData.bigquery_dataset_id, // 或者使用一個 uuid 確保唯一性
    name: queryData.bigquery_dataset_id, // 這裡僅作展示，可能需要從其他地方獲取更友好的客戶名稱
    bigquery_dataset_id: queryData.bigquery_dataset_id,
    facebook_social_account: null, // 編輯頁面不關心這些
    google_social_account: null, // 編輯頁面不關心這些
  };

  return (
    <ProtectedComponent>
      <div className="flex flex-col h-full bg-gray-900 text-white p-6 rounded-lg shadow-xl">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-orange-400">
            Edit Query: <span className="text-white">{queryData.name}</span>
          </h1>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold transition-all duration-300"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Delete
          </Button>
        </div>

        {/* Query Form */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <QueryForm
            client={clientForForm}
            initialData={{
              displayName: queryData.name,
              config: {
                sql_query: queryData.sql_query,
                schedule_type: queryData.schedule_type, // 直接傳遞 schedule_type
                cron_schedule: queryData.cron_schedule, // 直接傳遞 cron_schedule
                output_target: queryData.output_target,
                sheetId: queryData.output_config?.sheetId,
                tabName: queryData.output_config?.tabName,
                appendMode: queryData.output_config?.appendMode,
                email: queryData.output_config?.email,
              },
            }}
            queryId={queryId}
          />
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteQueryModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          queryId={queryId}
          queryName={queryData.name}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </ProtectedComponent>
  );
}