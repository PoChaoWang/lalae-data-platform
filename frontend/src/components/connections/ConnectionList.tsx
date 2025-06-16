// /components/connections/ConnectionList.tsx
'use client'; // Mark as a client component

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import type { Connection, ConnectionExecution } from '@/lib/definitions';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';

// Import icons from lucide-react, matching the new design
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Database,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';

// Import UI components from shadcn/ui (assuming they are set up in the project)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Switch is no longer needed
// import { Switch } from "@/components/ui/switch";


// Please change the URL in the env.local file if you need
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function ConnectionList() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedConnectionId, setExpandedConnectionId] = useState<number | null>(null);
  const [history, setHistory] = useState<ConnectionExecution[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // State for the configuration modal
  const [configModal, setConfigModal] = useState<{ open: boolean; config: any }>({ open: false, config: null });

    

  // --- NEW: TanStack Table Column Definitions ---
    // We define the table structure declaratively.
    const columns: ColumnDef<Connection>[] = [
      {
          accessorKey: 'is_enabled',
          header: 'Enabled',
          size: 100, // Initial size in pixels
          cell: ({ row }) => row.original.is_enabled ? (
              <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-400 font-medium">On</Badge>
          ) : (
              <Badge variant="secondary" className="bg-gray-600/50 text-gray-400 font-medium border-gray-700">Off</Badge>
          ),
      },
      {
          accessorKey: 'display_name',
          header: 'Display Name',
          size: 250,
          cell: ({ row }) => (
              <div className="flex items-center space-x-3">
                  <span className="text-white font-medium group-hover:text-orange-200 transition-colors duration-300">
                      {row.original.display_name}
                  </span>
              </div>
          )
      },
      {
          accessorKey: 'data_source.display_name',
          header: 'Data Source',
          size: 180,
      },
      {
          accessorKey: 'client.name',
          header: 'Client',
          size: 150,
      },
      {
          accessorKey: 'status',
          header: 'Status',
          size: 120,
          cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
          accessorKey: 'target_dataset_id',
          header: 'Target Dataset',
          size: 200,
          cell: ({ row }) => (
              <code className="bg-gray-900/50 text-orange-300 px-3 py-1 rounded-md text-sm font-mono whitespace-normal break-all">
                  {row.original.target_dataset_id}
              </code>
          ),
      },
      {
          accessorKey: 'updated_at',
          header: 'Last Updated',
          size: 220,
          cell: ({ row }) => formatDate(row.original.updated_at),
      },
      {
          id: 'history_expander',
          header: 'History',
          size: 100,
          cell: ({ row }) => (
              <div className="text-center">
                  <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-orange-400 hover:bg-orange-500/10"
                      onClick={(e) => {
                         // We keep the original expand logic to fetch data
                         e.stopPropagation();
                         handleToggleExpand(row.original.id);
                      }}
                      title={expandedConnectionId === row.original.id ? "Collapse history" : "Expand history"}
                  >
                      {expandedConnectionId === row.original.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </Button>
              </div>
          )
      }
  ];

  // --- NEW: TanStack Table Instance ---
  const table = useReactTable({
      data: connections,
      columns,
      getCoreRowModel: getCoreRowModel(),
      enableColumnResizing: true, // Enable the resizing feature
      columnResizeMode: 'onChange', // 'onChange' is smoother than 'onEnd'
      getRowId: (row) => String(row.id), // Use connection ID as the unique row ID
  });

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error('Authentication failed. Please log in to your Django admin and try again.');
          }
          throw new Error(`Failed to fetch connections: ${res.statusText}`);
        }
        const data = await res.json();
        setConnections(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, []);

  const handleToggleExpand = async (connectionId: number) => {
    if (expandedConnectionId === connectionId) {
        setExpandedConnectionId(null);
        return;
    }

    setExpandedConnectionId(connectionId);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistory([]);

    try {
        const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/executions/`, {
            credentials: 'include',
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Request failed with status ${res.status}`);
        }
        setHistory(await res.json());
    } catch (err: any) {
        setHistoryError(err.message);
    } finally {
        setHistoryLoading(false);
    }
};

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'ACTIVE':
        return <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400"><CheckCircle2 className="w-2 h-3" />{status}</Badge>;
      case 'RUNNING':
        return <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400 animate-pulse"><Loader2 className="w-2 h-3 animate-spin" />{status}</Badge>;
      case 'FAILED':
      case 'ERROR':
        return <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-400"><XCircle className="w-2 h-3" />{status}</Badge>;
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-400"><Loader2 className="w-2 h-3 animate-spin" />{status}</Badge>;
      case 'DISABLED':
          return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  // --- Loading State Placeholder ---
  if (loading) return (
    <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl overflow-hidden">
         <table className="w-full">
            <thead className="border-b border-gray-700/50">
                <tr>
                    <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Enabled</th>
                    <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Display Name</th>
                    <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Data Source</th>
                    <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Client</th>
                    <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Status</th>
                    <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Target Dataset</th>
                    <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase">Last Updated</th>
                    <th className="text-center py-4 px-6 text-orange-400 font-semibold text-sm uppercase">History</th>
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b border-gray-700/30">
                        <td className="py-4 px-6"><div className="h-6 bg-gray-700 rounded-full animate-pulse w-10"></div></td>
                        <td className="py-4 px-6"><div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div></td>
                        <td className="py-4 px-6"><div className="h-4 bg-gray-700 rounded animate-pulse w-1/2"></div></td>
                        <td className="py-4 px-6"><div className="h-4 bg-gray-700 rounded animate-pulse w-2/3"></div></td>
                        <td className="py-4 px-6"><div className="h-6 bg-gray-700 rounded-full animate-pulse w-20"></div></td>
                        <td className="py-4 px-6"><div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div></td>
                        <td className="py-4 px-6"><div className="h-4 bg-gray-700 rounded animate-pulse w-1/2"></div></td>
                        <td className="py-4 px-6 flex justify-center"><div className="h-8 w-8 bg-gray-700 rounded-md animate-pulse"></div></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );

  // --- Error State ---
  if (error) return (
    <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-6 flex items-center space-x-4 max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-red-400"/>
        <div>
            <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
            <p className="text-red-400 mt-1">{error}</p>
        </div>
    </div>
  );

  // --- No Data State ---
  if (!connections || connections.length === 0) {
    return (
      <div className="bg-blue-900/50 border border-blue-500/50 rounded-lg p-8 text-center">
          <Info className="w-12 h-12 text-blue-400 mx-auto mb-4"/>
          <h3 className="text-2xl font-bold text-blue-300">No Connections Found</h3>
          <p className="text-blue-400 mt-2">You currently have no connections configured.</p>
      </div>
    );
  }

  const colCount = 8;

  // --- Main Content ---
  return (
    <div className="relative">
       {/* Background Pattern: This can be removed if not desired in the list component itself */}
       <div className="absolute inset-0 opacity-5" style={{backgroundImage: `linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)`, backgroundSize: "50px 50px", pointerEvents: 'none'}}/>

       <div className="relative z-10">
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/10">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
                            <thead className="border-b border-gray-700/50">
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map(header => (
                                            <th 
                                                key={header.id} 
                                                className="relative py-4 px-6 text-left text-orange-400 font-semibold text-sm uppercase tracking-wider group"
                                                style={{ width: header.getSize() }}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                
                                                {/* Resizing Handle */}
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
                                            onClick={() => router.push(`/connections/${row.original.id}`)}
                                            className="border-b border-gray-700/30 hover:bg-orange-500/5 transition-all duration-300 group cursor-pointer"
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

                                        {/* Expandable Execution History (Original logic preserved) */}
                                        {expandedConnectionId === row.original.id && (
                                            <tr>
                                                <td colSpan={columns.length} className="p-0 bg-gray-900/20">
                                                    <div className="p-6">
                                                        {historyLoading && <div className="flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading history...</div>}
                                                        
                                                        {historyError && (
                                                            <div className="bg-red-900/50 border border-red-500/50 rounded-md p-4 flex items-center space-x-3">
                                                                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0"/>
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
                                                                        <Calendar className="w-4 h-4" />
                                                                        <span>Execution History</span>
                                                                    </h3>
                                                                    <div className="overflow-x-auto border border-gray-700/50 rounded-lg">
                                                                        <table className="w-full">
                                                                            <thead className="bg-gray-800/60">
                                                                                <tr className="border-b border-gray-700/50">
                                                                                    <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                                                                                    <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Started At</th>
                                                                                    <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Finished At</th>
                                                                                    <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Executed By</th>
                                                                                    <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Message</th>
                                                                                    <th className="text-left py-2 px-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Config</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {history.map(exec => (
                                                                                    <tr key={exec.id} className="border-b border-gray-700/30 last:border-b-0">
                                                                                        <td className="py-3 px-4">{getStatusBadge(exec.status)}</td>
                                                                                        <td className="py-3 px-4 text-gray-300 text-sm">{formatDate(exec.started_at)}</td>
                                                                                        <td className="py-3 px-4 text-gray-300 text-sm">{formatDate(exec.finished_at)}</td>
                                                                                        <td className="py-3 px-4 text-gray-300 text-sm">
                                                                                            <div className="flex items-center space-x-2">
                                                                                                <User className="w-4 h-4 text-gray-500" />
                                                                                                <span>{exec.triggered_by ? exec.triggered_by.username : <span className="text-gray-500 italic">Scheduled Task</span>}</span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="py-3 px-4 text-gray-300 text-sm max-w-xs whitespace-normal break-words">{exec.message || <span className="text-gray-500">-</span>}</td>
                                                                                        <td className="py-3 px-4">
                                                                                            <Button variant="outline" size="sm" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300" onClick={() => setConfigModal({ open: true, config: exec.config })}>
                                                                                                View
                                                                                            </Button>
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
        </div>
      </div>

       {/* Config View Modal */}
       <Dialog open={configModal.open} onOpenChange={(open: boolean) => setConfigModal({ ...configModal, open })}>
            <DialogContent className="bg-gray-800 border-orange-500/30 text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-orange-400 flex items-center space-x-2">
                    <Database className="w-5 h-5" />
                    <span>Connection Configuration</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 overflow-auto max-h-96">
                        <pre className="text-sm text-gray-300">
                            <code>{JSON.stringify(configModal.config, null, 2)}</code>
                        </pre>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}
