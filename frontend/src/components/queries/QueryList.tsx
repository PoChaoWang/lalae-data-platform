// frontend/src/components/queries/QueryList.tsx
'use client';

import { useState, useEffect, Fragment, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';
// 引入調整後的類型，特別是 Client 類型，以及更新後的 QueryListResponse
import type { QueryDefinition, QueryRunResult, Client, QueryListResponse, QueryExecutionHistoryResponse, RerunQueryResponse } from '@/lib/definitions';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';

// Import icons from lucide-react
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  AlertTriangle,
  Loader2,
  Download,
  Play,
  Pencil,
  Trash2,
  ListRestart
} from 'lucide-react';

// Import UI components from shadcn/ui
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationFirst, PaginationNext, PaginationPrevious, PaginationLast } from "@/components/ui/pagination";
import DeleteQueryModal from './DeleteQueryModal';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function QueryList() {
  const router = useRouter();
  const { protectedFetch } = useProtectedFetch();
  const [queries, setQueries] = useState<QueryDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedQueryId, setExpandedQueryId] = useState<number | null>(null);
  const [history, setHistory] = useState<QueryRunResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [currentDataset, setCurrentDataset] = useState<string>('');

  const [clientDatasets, setClientDatasets] = useState<Pick<Client, 'id' | 'name' | 'bigquery_dataset_id'>[]>([]);
  const [currentClientName, setCurrentClientName] = useState<string>('');
  const [currentAccessLevel, setCurrentAccessLevel] = useState<string>('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  const [pollingTasks, setPollingTasks] = useState<Map<number, NodeJS.Timeout>>(new Map());
  const activePollingRunResults = useRef<Set<number>>(new Set());

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [queryToDelete, setQueryToDelete] = useState<{ id: number; name: string } | null>(null);

  // --- TanStack Table Column Definitions ---
  const handleDownloadResult = async (queryId: number, resultId: number) => {
    if (!protectedFetch) {
      alert('Fetch client not initialized.');
      return;
    }
  
    try {
      const url = `${NEXT_PUBLIC_TO_BACKEND_URL}/queries/${queryId}/download-result/${resultId}/`;
      // protectedFetch 會自動添加 JWT Header
      const response = await protectedFetch(url);
  
      if (!response.ok) {
        // 嘗試解析錯誤訊息
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { detail: `HTTP error! status: ${response.status}` };
        }
        throw new Error(errorData.detail || `Failed to download result: ${response.statusText}`);
      }
  
      // 獲取 blob 資料
      const blob = await response.blob();
      // 獲取 Content-Disposition header 來解析檔案名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `query_result_${queryId}_${resultId}.csv`; // 默認檔案名
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\n]*?)['"]?$/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1].replace(/^UTF-8''/, ''));
        }
      }
  
  
      // 創建一個新的 Blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename); // 設置下載的檔案名
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl); // 釋放 Blob URL
  
    } catch (error: any) {
      console.error('Download error:', error);
      alert(error.message || 'An error occurred while downloading the result.');
    }
  };

  const handleDeleteQueryClick = (queryId: number, queryName: string) => {
    setQueryToDelete({ id: queryId, name: queryName });
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setQueryToDelete(null);
  };

  const handleQueryDeletedSuccess = () => {
    fetchQueries(currentPage, currentDataset);
    setExpandedQueryId(null);
  };

  const columns: ColumnDef<QueryDefinition>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 250,
      cell: ({ row }) => (
        <Button
          variant="link"
          className="p-0 h-auto text-white hover:text-orange-300 transition-colors duration-300"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/queries/${row.original.id}`);
          }}
        >
          {row.original.name}
        </Button>
      ),
    },
    // {
    //   accessorKey: 'description',
    //   header: 'Description',
    //   size: 300,
    //   cell: ({ row }) => (
    //     <span className="text-gray-400">
    //       {row.original.description ? row.original.description.substring(0, 100) + (row.original.description.length > 100 ? '...' : '') : 'N/A'}
    //     </span>
    //   ),
    // },
    {
      accessorKey: 'schedule_type',
      header: 'Schedule',
      size: 80,
      cell: ({ row }) => (
        <Badge variant="outline" className="border-gray-600 bg-gray-700/30 text-gray-300">
          {row.original.schedule_type === 'ONCE' ? 'ONCE' : row.original.schedule_type}
        </Badge>
      ),
    },
    // {
    //   accessorKey: 'output_target',
    //   header: 'Output',
    //   size: 120,
    //   cell: ({ row }) => (
    //     <Badge variant="outline" className="border-gray-600 bg-gray-700/30 text-gray-300">
    //       {row.original.output_target === 'NONE' ? 'None' : row.original.output_target}
    //     </Badge>
    //   ),
    // },
    {
      accessorKey: 'latest_execution_time',
      header: 'Last Run',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center space-x-2 text-gray-400">
          <Clock className="w-4 h-4 text-gray-500" />
          <span>{row.original.latest_execution_time || 'Never'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'latest_status',
      header: 'Status',
      size: 80,
      cell: ({ row }) => getStatusBadge(row.original.last_run_status),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 200,
      minSize: 150,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
            onClick={(e) => { e.stopPropagation(); router.push(`/queries/${row.original.id}`); }}
            title="Edit Query"
          >
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={(e) => { e.stopPropagation(); handleDeleteQueryClick(row.original.id, row.original.name); }}
            title="Delete Query"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
          {row.original.has_downloadable_result && row.original.last_successful_run_result?.id && (
            <Button
              variant="outline"
              size="sm"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
              onClick={(e) => {
                e.stopPropagation(); // 防止觸發行展開
                handleDownloadResult(row.original.id, row.original.last_successful_run_result!.id);
              }}
              title="Download Result"
            >
              <Download className="w-4 h-4 mr-1" /> Download
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
            onClick={(e) => { e.stopPropagation(); handleRunQuery(row.original); }} // 呼叫 handleRunQuery 並傳遞整個 QueryDefinition 物件
            // disabled 條件：例如，如果查詢已經在 RUNNING 狀態，則禁用 Rerun
            disabled={row.original.latest_status === 'RUNNING'}
            data-query-id={row.original.id} // Added for button identification
            title="Rerun Query"
          >
            <Play className="w-4 h-4 mr-1" /> Rerun
          </Button>
        </div>
      ),
    },
    {
      id: 'history_expander',
      header: 'History',
      size:100,
      maxSize: 100,
      minSize: 80,
      cell: ({ row }) => (
        <div className="text-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-orange-400 hover:bg-orange-500/10"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand(row.original.id);
            }}
            title={expandedQueryId === row.original.id ? "Collapse history" : "Expand history"}
          >
            {expandedQueryId === row.original.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>
      ),
    },
  ];

  // --- TanStack Table Instance ---
  const table = useReactTable({
    data: queries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getRowId: (row) => String(row.id),
  });

  const fetchQueries = async (page: number, datasetId: string) => {
    if (!protectedFetch) {
      setError('Fetch client not initialized.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 步驟 1: 正確地創建一個 URL 物件
      // 初始化 URL 時就包含基本的路徑和 page 參數
      const baseUrl = `${NEXT_PUBLIC_TO_BACKEND_URL}/queries/`;
      const urlObj = new URL(baseUrl); // 這裡創建的是 URL 物件，不是發送請求！
      urlObj.searchParams.append('page', page.toString()); // 在 URL 物件上添加 page 參數
  
      if (datasetId) { // 如果 datasetId 存在，才添加到 URL 物件中
        urlObj.searchParams.append('dataset_id', datasetId);
      }
  
      // 步驟 2: 將構建好的 URL 物件轉換為字串，再傳遞給 protectedFetch
      const res = await protectedFetch(urlObj.toString()); // 這裡的 res 才是 Response 物件
  
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to fetch queries: ${res.statusText}`);
      }
      const data: {
        count: number;
        next: string | null;
        previous: string | null;
        results: QueryDefinition[];
        current_dataset: string;
        client_datasets: Pick<Client, 'id' | 'name' | 'bigquery_dataset_id'>[];
        current_client_name: string;
        current_access_level: string;
      } = await res.json();
  
      // console.log("API response data:", data);
      // console.log("Client datasets from API:", data.client_datasets);
  
  
      setQueries(data.results);
      setTotalCount(data.count);
      setHasNextPage(!!data.next);
      setHasPreviousPage(!!data.previous);
      setCurrentPage(page);
  
      setCurrentDataset(data.current_dataset);
      setClientDatasets(data.client_datasets);
      setCurrentClientName(data.current_client_name);
      setCurrentAccessLevel(data.current_access_level);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startPollingForResult = (queryId: number, runResultId: number) => {
    if (!protectedFetch) {
      return;
    }
    // 防止重複啟動輪詢
    if (pollingTasks.has(queryId)) {
      clearInterval(pollingTasks.get(queryId)!);
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/${queryId}/executions/`);
        if (!res.ok) {
          throw new Error(`Failed to fetch execution history for polling.`);
        }
        const data: QueryExecutionHistoryResponse = await res.json();
        const latestRunResult = data.executions.find(exec => exec.id === runResultId);

        if (latestRunResult && (latestRunResult.status === 'SUCCESS' || latestRunResult.status === 'FAILED' || latestRunResult.status === 'OUTPUT_ERROR')) {
          clearInterval(pollInterval);
          setPollingTasks(prev => {
            const newMap = new Map(prev);
            newMap.delete(queryId);
            return newMap;
          });
          activePollingRunResults.current.delete(runResultId); // 從 Set 中移除

          setQueries(prevQueries => prevQueries.map(q =>
            q.id === queryId
              ? {
                  ...q,
                  // 這裡進行類型斷言
                  last_run_status: latestRunResult.status as QueryDefinition['last_run_status'],
                  latest_status: latestRunResult.status as QueryDefinition['last_run_status'],
                  has_downloadable_result: latestRunResult.status === 'SUCCESS' || latestRunResult.status === 'OUTPUT_ERROR',
                  last_successful_run_result: latestRunResult.status === 'SUCCESS' ? latestRunResult : q.last_successful_run_result,
                  latest_execution_time: latestRunResult.executed_at || q.latest_execution_time,
                }
              : q
          ));
        }
      } catch (err) {
        console.error(`Error during polling for queryId ${queryId}:`, err);
        // 錯誤發生時也停止輪詢，避免無限請求
        clearInterval(pollInterval);
        setPollingTasks(prev => {
          const newMap = new Map(prev);
          newMap.delete(queryId);
          return newMap;
        });
        activePollingRunResults.current.delete(runResultId);
      }
    }, 3000); // 每 3 秒輪詢一次

    setPollingTasks(prev => {
      const newMap = new Map(prev);
      newMap.set(queryId, pollInterval);
      return newMap;
    });
    activePollingRunResults.current.add(runResultId);
  };

  useEffect(() => {
    return () => {
      pollingTasks.forEach(intervalId => clearInterval(intervalId));
    };
  }, [pollingTasks]);

  useEffect(() => {
    fetchQueries(currentPage, currentDataset);
  }, [protectedFetch, currentPage, currentDataset]);


  const handleToggleExpand = async (queryId: number) => {
    if (!protectedFetch) {
      return;
    }
    if (expandedQueryId === queryId) {
      setExpandedQueryId(null);
      return;
    }

    setExpandedQueryId(queryId);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistory([]);

    try {
      const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/${queryId}/executions/`);
      if (!res.ok) {
        const errorData: QueryExecutionHistoryResponse = await res.json();
        throw new Error(errorData.message || `Request failed with status ${res.status}`);
      }
      const data: QueryExecutionHistoryResponse = await res.json();
      setHistory(data.executions);
    } catch (err: any) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRunQuery = async (queryDefinition: QueryDefinition) => {
    if (!protectedFetch) {
      alert('Fetch client not initialized.');
      return;
    }

    const button = document.querySelector(`button[data-query-id="${queryDefinition.id}"]`);
    const originalContent = button?.innerHTML;
    if (button) {
      button.setAttribute('disabled', 'true');
      button.innerHTML = '<span class="spinner-border spinner-border-sm mr-2 animate-spin"></span> Running...';
    }

    try {
      const payload = {
        sql_query: queryDefinition.sql_query,
        name: queryDefinition.name,
        bigquery_dataset_id: queryDefinition.bigquery_dataset_id,
        is_test_passed: true,
      };

      const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/run-query/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert('Query execution initiated successfully!');
        // 立即更新前端該查詢的狀態為 RUNNING
        setQueries(prevQueries => prevQueries.map(q =>
          q.id === queryDefinition.id
            ? { ...q, 
              last_run_status: 'RUNNING', 
              latest_status: 'RUNNING' 
            }
            : q
        ));
        // 啟動輪詢來檢查任務狀態
        if (data.execution_id) {
          startPollingForResult(queryDefinition.id, data.execution_id);
        }

      } else {
        throw new Error(data.error || 'Failed to execute query');
      }
    } catch (error: any) {
      console.error('Execution error:', error);
      alert(error.message || 'An error occurred while executing the query');
    } finally {
      if (button && originalContent) {
        button.removeAttribute('disabled');
        button.innerHTML = originalContent;
      }
    }
  };


  const handleDatasetSwitch = async (datasetId: string) => {
    if (!protectedFetch) {
      alert('Fetch client not initialized.');
      return;
    }

    if (datasetId === "default-placeholder") { // 檢查是否是我們的特殊 placeholder 值
      setCurrentDataset(''); // 將 currentDataset 清空，以顯示 placeholder
      setQueries([]); // 清空當前顯示的查詢
      setTotalCount(0); // 重置總數
      setTotalPages(1); // 重置總頁數
      setHasNextPage(false);
      setHasPreviousPage(false);
      return; // 不發送 API 請求
      }

    try {
      const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/switch-dataset/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataset_id: datasetId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to switch dataset: ${res.statusText}`);
      }
      setCurrentDataset(datasetId);
      fetchQueries(1, datasetId);
      setCurrentPage(1);
    } catch (error: any) {
      alert(error.message || 'Error switching dataset.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400">Success</Badge>;
      case 'RUNNING':
        return (
          <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400 flex items-center justify-center">
            <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Running
          </Badge>
        );
      case 'FAILED':
        return <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-400">Failed</Badge>;
      case 'SCHEDULED':
        return <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-400">Scheduled</Badge>;
      case 'OUTPUT_ERROR':
        return <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-400">Output Error</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="secondary" className="bg-gray-600/50 text-gray-400">Pending</Badge>;
    }
  };

  // --- Loading State Placeholder ---
  if (loading) return (
    <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead className="border-b border-gray-700/50">
          <tr>
            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Name</th>
            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Schedule</th>
            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Last Run</th>
            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Status</th>
            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Actions</th>
            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">History</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, index) => (
            <tr key={index} className="border-b border-gray-700/30">
              <td className="py-4 px-6"><div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div></td>
              <td className="py-4 px-6"><div className="h-6 bg-gray-700 rounded-full animate-pulse w-20"></div></td>
              <td className="py-4 px-6"><div className="h-4 bg-gray-700 rounded animate-pulse w-1/2"></div></td>
              <td className="py-4 px-6"><div className="h-6 bg-gray-700 rounded-full animate-pulse w-20"></div></td>
              <td className="py-4 px-6"><div className="h-6 bg-gray-700 rounded-full animate-pulse w-20"></div></td>
              <td className="py-4 px-6"><div className="h-6 bg-gray-700 rounded-full animate-pulse w-20"></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // --- Error State ---
  if (error) return (
    <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-6 flex items-center space-x-4 max-w-lg mx-auto">
      <AlertTriangle className="w-10 h-10 text-red-400" />
      <div>
        <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
        <p className="text-red-400 mt-1">{error}</p>
      </div>
    </div>
  );

  // --- No Data State ---
  if (!queries || queries.length === 0 && !loading && !error) {
    return (
      <div className="bg-blue-900/50 border border-blue-500/50 rounded-lg p-8 text-center">
        <Info className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-blue-300">No Queries Found</h3>
        <p className="text-blue-400 mt-2">You currently have no queries configured for this dataset, or no dataset is selected.</p>
        <div className="mt-4 flex justify-center">
        <Select onValueChange={handleDatasetSwitch} value={currentDataset}>
          <SelectTrigger className="w-[200px] bg-gray-700 border-gray-600 text-white">
            <SelectValue placeholder="Select Dataset" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700 text-white">
          <SelectItem value="default-placeholder" disabled>Select Dataset</SelectItem>
                    {clientDatasets && clientDatasets.length > 0 && clientDatasets.map((dataset) => (
                      // 在這裡，確保 dataset.bigquery_dataset_id 確實不是空字串
                      // 如果理論上可能為空，則需要過濾掉或者提供一個備用值
                      dataset.bigquery_dataset_id ? ( // 僅渲染 bigquery_dataset_id 不為空的值
                        <SelectItem key={dataset.bigquery_dataset_id} value={dataset.bigquery_dataset_id}>
                          {dataset.name} ({dataset.bigquery_dataset_id})
                        </SelectItem>
                      ) : null
                    ))}
          </SelectContent>
        </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)`, backgroundSize: "50px 50px", pointerEvents: 'none' }} />

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
                <Select onValueChange={handleDatasetSwitch} value={currentDataset}>
                    <SelectTrigger className="w-[200px] bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select Dataset" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {clientDatasets && clientDatasets.length > 0 && clientDatasets.map((dataset) => ( // <-- 添加檢查
                      <SelectItem key={dataset.bigquery_dataset_id} value={dataset.bigquery_dataset_id}>
                        {dataset.name} ({dataset.bigquery_dataset_id})
                      </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                {currentDataset && (
                    <div className="ml-4 text-sm text-gray-400">
                        <strong>Current Dataset:</strong> <code className="bg-gray-900/50 text-orange-300 px-2 py-1 rounded-md text-xs font-mono">{currentDataset}</code>
                        {currentClientName && (
                            <>
                                <br />
                                <strong>Client:</strong> {currentClientName} ({currentAccessLevel})
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/10">
          <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead className="border-b border-gray-700/50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="relative py-4 px-6 text-center text-orange-400 font-semibold text-sm uppercase tracking-wider group"
                        style={{ width: header.getSize() }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute top-0 right-0 h-full w-1 bg-orange-500/50 cursor-col-resize select-none touch-none
                            opacity-0 group-hover:opacity-100 transition-opacity ${header.column.getIsResizing() ? 'bg-orange-400 opacity-100' : ''}`}
                        />
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <Fragment key={row.id}>
                    <tr
                      className="border-b border-gray-700/30 hover:bg-orange-500/5 transition-all duration-300 group"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          className="py-4 px-6 text-gray-300 align-top"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>

                    {/* Expandable Execution History */}
                    {expandedQueryId === row.original.id && (
                      <tr>
                        <td colSpan={columns.length} className="p-0 bg-gray-900/20">
                          <div className="p-6">
                            {historyLoading && <div className="flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading history...</div>}

                            {historyError && (
                              <div className="bg-red-900/50 border border-red-500/50 rounded-md p-4 flex items-center space-x-3">
                                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                                <div>
                                  <h4 className="font-bold text-red-300">Error fetching history</h4>
                                  <p className="text-sm text-red-400">{historyError}</p>
                                </div>
                              </div>
                            )}

                            {!historyLoading && !historyError && (
                              history.length === 0 ? (
                                <div className="text-center text-gray-500 py-4">No execution history found.</div>
                              ) : (
                                <div>
                                  <h3 className="text-orange-400 font-semibold mb-4 flex items-center space-x-2">
                                    <ListRestart className="w-4 h-4" />
                                    <span>Execution History (Last 10)</span>
                                  </h3>
                                  <div className="overflow-x-auto border border-gray-700/50 rounded-lg">
                                    <table className="w-full">
                                      <thead className="bg-gray-800/60">
                                        <tr className="border-b border-gray-700/50">
                                          <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Executed At</th>
                                          <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                                          <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Message</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {history.map(exec => (
                                          <tr key={exec.id} className="border-b border-gray-700/30 last:border-b-0">
                                            <td className="py-3 px-4 text-gray-300 text-sm">{exec.executed_at || 'N/A'}</td>
                                            <td className="py-3 px-4">{getStatusBadge(exec.status)}</td>
                                            <td className="py-3 px-4 text-gray-300 text-sm max-w-xs whitespace-normal break-words">
                                              {exec.result_message && exec.error_message ? (
                                                <>
                                                  {exec.result_message}<br />{exec.error_message}
                                                </>
                                              ) : exec.result_message ? (
                                                exec.result_message
                                              ) : exec.error_message ? (
                                                exec.error_message
                                              ) : (
                                                <span className="text-gray-500">-</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-700/50">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationFirst
                      onClick={() => setCurrentPage(1)}
                      aria-disabled={!hasPreviousPage || currentPage === 1}
                      className={!hasPreviousPage || currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(currentPage - 1)}
                      aria-disabled={!hasPreviousPage || currentPage === 1}
                      className={!hasPreviousPage || currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive>{currentPage} / {totalPages}</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(currentPage + 1)}
                      aria-disabled={!hasNextPage || currentPage === totalPages}
                      className={!hasNextPage || currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLast
                      onClick={() => setCurrentPage(totalPages)}
                      aria-disabled={!hasNextPage || currentPage === totalPages}
                      className={!hasNextPage || currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <div className="text-center text-gray-500 mt-2 text-sm">
                Showing {queries.length} of {totalCount} queries.
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Delete Query Modal */}
      {isDeleteModalOpen && queryToDelete && ( // <--- 條件渲染 DeleteQueryModal
        <DeleteQueryModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          queryId={queryToDelete.id}
          queryName={queryToDelete.name}
          onSuccess={handleQueryDeletedSuccess}
        />
      )}
    </div>
  );
}