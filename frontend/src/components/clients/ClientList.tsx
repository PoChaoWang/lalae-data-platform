// app/components/clients/ClientList.tsx
'use client'; // ★ 關鍵第一步：標記為客戶端元件

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Client } from '@/lib/definitions'; 

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, Database, Calendar, User } from "lucide-react"

const API_URL = `${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/clients/`;

export default function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(API_URL, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 403 || response.status === 401) {
            throw new Error('驗證失敗，請確認您已登入。');
          }
          throw new Error(`獲取資料失敗: ${response.statusText}`);
        }

        const data = await response.json();

        // 處理 Django Rest Framework 的分頁回應
        if (data && Array.isArray(data.results)) {
          setClients(data.results);
        } else if (Array.isArray(data)) {
          setClients(data);
        } else {
          console.warn('API 回應格式非預期:', data);
          setClients([]);
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []); 

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 transition-all duration-300 shadow-lg shadow-green-500/20">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
          Active
        </Badge>
      )
    }
    return (
      <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30 hover:bg-gray-600/30 transition-all duration-300">
        <div className="w-2 h-2 bg-gray-500 rounded-full mr-2" />
        Inactive
      </Badge>
    )
  }

  // Helper function to format date strings
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }
  
  // ★ New: Skeleton loader matching the new UI design
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)`, backgroundSize: "50px 50px" }} />
        <div className="relative z-10 max-w-7xl mx-auto animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
                    <div>
                        <div className="h-10 w-48 bg-gray-700 rounded-md"></div>
                        <div className="h-4 w-64 bg-gray-700 rounded-md mt-2"></div>
                    </div>
                </div>
                <div className="h-12 w-44 bg-gray-700 rounded-lg"></div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800/50 border border-orange-500/20 rounded-xl p-6 h-24"></div>
                <div className="bg-gray-800/50 border border-orange-500/20 rounded-xl p-6 h-24"></div>
                <div className="bg-gray-800/50 border border-orange-500/20 rounded-xl p-6 h-24"></div>
            </div>

            {/* Table Skeleton */}
            <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6">
                <div className="h-8 w-48 bg-gray-700 rounded-md mb-6"></div>
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                            <div className="h-10 w-10 bg-gray-700 rounded-lg"></div>
                            <div className="h-6 flex-1 bg-gray-700 rounded-md"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    )
  }

  // Error state remains a simple, clear message
  if (error) {
    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
            <div className="bg-red-900/50 border border-red-500/50 text-red-300 p-6 rounded-lg max-w-md mx-auto text-center">
                <h2 className="text-xl font-bold mb-2">An Error Occurred</h2>
                <p>{error}</p>
            </div>
        </div>
    );
  }

  // ★ Main component render with new styles and dynamic data
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)`, backgroundSize: "50px 50px" }} />

      <div className="relative z-10 max-w-7xl mx-auto">
        

        {/* Stats Cards -- Now powered by API data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-orange-500/20 rounded-xl p-6 hover:border-orange-500/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm">Total Clients</p>
                        <p className="text-2xl font-bold text-white">{clients.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-orange-500" />
                </div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm border border-orange-500/20 rounded-xl p-6 hover:border-orange-500/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm">Active Clients</p>
                        <p className="text-2xl font-bold text-green-400">{clients.filter((c) => c.is_active).length}</p>
                    </div>
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center"><div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" /></div>
                </div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm border border-orange-500/20 rounded-xl p-6 hover:border-orange-500/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm">Datasets</p>
                        <p className="text-2xl font-bold text-orange-400">{clients.length}</p>
                    </div>
                    <Database className="w-8 h-8 text-orange-500" />
                </div>
            </div>
        </div>

        {/* Clients Table -- Now powered by API data */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/10">
            <div className="bg-gray-900/50 border-b border-orange-500/20 px-6 py-4">
                <h2 className="text-xl font-semibold text-orange-400 flex items-center space-x-2">
                    <Database className="w-5 h-5" />
                    <span>Client Database</span>
                </h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-700/50">
                            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase tracking-wider">Name</th>
                            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase tracking-wider">BigQuery Dataset ID</th>
                            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase tracking-wider">Status</th>
                            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase tracking-wider">Created At</th>
                            <th className="text-left py-4 px-6 text-orange-400 font-semibold text-sm uppercase tracking-wider">Created By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-400">No clients found.</td>
                            </tr>
                        ) : (
                            clients.map((client) => (
                                <tr key={client.id} className="border-b border-gray-700/30 hover:bg-orange-500/5 hover:border-orange-500/20 transition-all duration-300 group cursor-pointer">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-orange-400/20 to-orange-600/20 rounded-lg flex items-center justify-center border border-orange-500/20 group-hover:border-orange-500/40 transition-all duration-300">
                                                <span className="text-orange-400 font-bold text-sm">{client.name.charAt(0)}</span>
                                            </div>
                                            <div>
                                                <Link href={`/clients/${client.id}`} className="text-white font-medium group-hover:text-orange-200 transition-colors duration-300">{client.name}</Link>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <code className="bg-gray-900/50 text-orange-300 px-3 py-1 rounded-md text-sm font-mono border border-gray-700/50 group-hover:border-orange-500/30 transition-all duration-300">
                                            {client.bigquery_dataset_id || "-"}
                                        </code>
                                    </td>
                                    <td className="py-4 px-6">{getStatusBadge(client.is_active)}</td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center space-x-2 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                                            <Calendar className="w-4 h-4 text-gray-500" />
                                            <span>{client.created_at ? formatDate(client.created_at) : "-"}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center space-x-2 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                                            <User className="w-4 h-4 text-gray-500" />
                                            <span>{client.created_by || "-"}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="bg-gray-900/30 border-t border-orange-500/20 px-6 py-4">
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Showing {clients.length} of {clients.length} clients</span>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        <span>Real-time data</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}