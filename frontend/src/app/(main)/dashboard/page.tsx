"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users,
  Zap,
  Database,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Calendar,
  FileText,
  ExternalLink,
  PlusCircle, // Import PlusCircle icon for the new buttons
} from "lucide-react"
// 引入 definitions.ts 中定義的型別
import type { Client, Connection, QueryDefinition, ConnectionExecution, QueryRunResult } from '@/lib/definitions';
// 引入 useProtectedFetch Hook - 修正了路徑
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';
import Link from 'next/link'; // Import Link for navigation


// 定義從後端 API 預期獲取的資料型別
interface DashboardData {
  clients: Client[];
  connections: Connection[];
  queries: QueryDefinition[];
  recentConnectionExecutions: ConnectionExecution[];
  recentQueryExecutions: QueryRunResult[];
}

// Donut Chart Component (keeping the existing one)
function DonutChart({ data, size = 200 }: { data: { active: number; error: number; pending: number }; size?: number }) {
  const total = data.active + data.error + data.pending
  const radius = size / 2 - 20
  const circumference = 2 * Math.PI * radius

  const activePercent = (data.active / total) * 100
  const errorPercent = (data.error / total) * 100
  const pendingPercent = (data.pending / total) * 100

  const activeStroke = (activePercent / 100) * circumference
  const errorStroke = (errorPercent / 100) * circumference
  const pendingStroke = (pendingPercent / 100) * circumference

  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(75, 85, 99, 0.3)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(34, 197, 94)"
          strokeWidth="8"
          strokeDasharray={`${activeStroke} ${circumference}`}
          strokeDashoffset="0"
          className="drop-shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"
          style={{ animationDuration: "3s" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(239, 68, 68)"
          strokeWidth="8"
          strokeDasharray={`${errorStroke} ${circumference}`}
          strokeDashoffset={-activeStroke}
          className="drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"
          style={{ animationDuration: "2s" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(249, 115, 22)"
          strokeWidth="8"
          strokeDasharray={`${pendingStroke} ${circumference}`}
          strokeDashoffset={-(activeStroke + errorStroke)}
          className="drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse"
          style={{ animationDuration: "2.5s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{total}</div>
          <div className="text-sm text-gray-400">Total</div>
        </div>
      </div>
    </div>
  )
}

// Enhanced Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "orange",
  subtitle,
}: {
  title: string
  value: number
  icon: any
  trend?: { value: number; isPositive: boolean }
  color?: "orange" | "green" | "red" | "blue"
  subtitle?: string
}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0
      const increment = value / 50
      const counter = setInterval(() => {
        current += increment
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(counter)
        } else {
          setDisplayValue(Math.floor(current))
        }
      }, 30)
      return () => clearInterval(counter)
    }, 200)

    return () => clearTimeout(timer)
  }, [value])

  const colorClasses = {
    orange: {
      border: "border-orange-500/20 hover:border-orange-500/40",
      bg: "bg-orange-500/20 group-hover:bg-orange-500/30",
      text: "text-orange-400",
      gradient: "from-orange-400 to-orange-600",
      glow: "shadow-orange-500/10",
    },
    green: {
      border: "border-green-500/20 hover:border-green-500/40",
      bg: "bg-green-500/20 group-hover:bg-green-500/30",
      text: "text-green-400",
      gradient: "from-green-400 to-green-600",
      glow: "shadow-green-500/10",
    },
    red: {
      border: "border-red-500/20 hover:border-red-500/40",
      bg: "bg-red-500/20 group-hover:bg-red-500/30",
      text: "text-red-400",
      gradient: "from-red-400 to-red-600",
      glow: "shadow-red-500/10",
    },
    blue: {
      border: "border-blue-500/20 hover:border-blue-500/40",
      bg: "bg-blue-500/20 group-hover:bg-blue-500/30",
      text: "text-blue-400",
      gradient: "from-blue-400 to-blue-600",
      glow: "shadow-blue-500/10",
    },
  }

  const colors = colorClasses[color]

  return (
    <div
      className={`bg-gray-800/30 backdrop-blur-sm border ${colors.border} rounded-2xl p-6 transition-all duration-300 hover:scale-105 group relative overflow-hidden shadow-2xl ${colors.glow}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent via-${color}-500/5 to-transparent animate-pulse pointer-events-none`}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center transition-all duration-300`}
          >
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>
          {trend && (
            <div
              className={`flex items-center space-x-1 text-sm ${trend.isPositive ? "text-green-400" : "text-red-400"}`}
            >
              <TrendingUp className={`w-4 h-4 ${trend.isPositive ? "" : "rotate-180"}`} />
              <span>{trend.value}%</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className={`text-4xl font-bold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
            {displayValue.toLocaleString()}
          </div>
          <div className="text-gray-400 font-medium">{title}</div>
          {subtitle && <div className="text-gray-500 text-sm">{subtitle}</div>}
        </div>
      </div>
    </div>
  )
}

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function DashboardPage() {
  // 使用 useProtectedFetch Hook 來獲取帶有認證的 fetch 函數
  const { protectedFetch } = useProtectedFetch();

  // 定義狀態來儲存從 API 獲取的資料，以及加載和錯誤狀態
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Initialize error to null

  // 定義一個異步函數來獲取儀表板資料
  const getDashboardData = useCallback(async () => {
    setLoading(true); // 開始加載，設定加載狀態為 true
    setError(null); // 清除之前的錯誤訊息
    try {
      // 確保 protectedFetch 可用
      if (!protectedFetch) {
        throw new Error('Protected fetch function is not available.');
      }
      // 實際應用中，將 URL 替換為您的 Django API 端點
      const response =await protectedFetch(
        `${NEXT_PUBLIC_TO_BACKEND_URL}/dashboard/`
      );
      if (!response.ok) {
        // 如果響應不成功，拋出錯誤
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch dashboard data.');
      }
      const jsonData: DashboardData = await response.json(); // 解析 JSON 響應
      setData(jsonData); // 設定獲取的資料到狀態中
      setError(null); // Ensure error is null on successful fetch
    } catch (err: any) {
      // 捕獲錯誤並設定錯誤訊息
      console.error("Error fetching dashboard data:", err);
      setError(err.message || 'An unknown error occurred.');
      setData(null); // Clear data on error
    } finally {
      setLoading(false); // 無論成功或失敗，都設定加載狀態為 false
    }
  }, [protectedFetch]); // 依賴 protectedFetch，確保它穩定

  // 在元件掛載時獲取資料
  useEffect(() => {
    if (protectedFetch) { // 只有當 protectedFetch 準備好時才開始獲取資料
      const timer = setTimeout(() => {
        getDashboardData();
      }, 100); // 嘗試延遲 100ms
      return () => clearTimeout(timer);
    }
  }, [protectedFetch, getDashboardData]); // 依賴 protectedFetch 和 getDashboardData


  // 如果正在加載，顯示加載動畫
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500 mb-4"></div>
          <p className="text-xl text-gray-400">Loading Dashboard Data...</p>
        </div>
      </div>
    );
  }

  // 如果有錯誤，顯示錯誤訊息
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center p-6 bg-red-900/20 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={getDashboardData}
            className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-md text-white font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // 如果沒有資料（通常在加載中或錯誤處理後），也顯示一個訊息
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-xl text-gray-400">No dashboard data available.</p>
      </div>
    );
  }

  // 計算統計數據
  const totalClients = data.clients.length
  const activeClients = data.clients.filter((c) => c.is_active).length

  const totalConnections = data.connections.length
  const enabledConnections = data.connections.filter((c) => c.is_enabled).length
  const connectionsByStatus = {
    active: data.connections.filter((c) => c.status === "ACTIVE").length,
    error: data.connections.filter((c) => c.status === "ERROR").length,
    pending: data.connections.filter((c) => c.status === "PENDING").length,
  }

  const connectionsByDataSource = data.connections.reduce(
    (acc, conn) => {
      const source = conn.data_source.display_name
      acc[source] = (acc[source] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const totalQueries = data.queries.length
  const queriesBySchedule = data.queries.reduce(
    (acc, query) => {
      const type = query.schedule_type === "PERIODIC" ? "Scheduled" : "Manual"
      acc[type] = (acc[type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const errorConnections = data.recentConnectionExecutions.filter((exec) => exec.status === "FAILED")
  const errorQueries = data.recentQueryExecutions.filter((exec) => exec.status === "FAILED")

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-orange-500/10 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-24 h-24 border border-orange-500/5 rounded-full animate-ping" />
        <div className="absolute bottom-1/4 left-1/3 w-16 h-16 bg-orange-500/5 rounded-full animate-bounce" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-2xl shadow-orange-500/25">
              <Activity className="w-8 h-8 text-black" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent">
                System Dashboard
              </h1>
              <p className="text-gray-400 mt-1">Real-time platform analytics and monitoring</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Live data • Last updated: just now</span>
          </div>
        </div>

        {/* Clients Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
            <Users className="w-6 h-6" />
            <span>Clients Overview</span>
          </h2>
          {totalClients === 0 ? (
            <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 text-center">
              <p className="text-gray-400 mb-4">No clients found. Start by creating your first client.</p>
              <Link href="http://localhost:3000/clients/new" passHref>
                <button className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors">
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Create Client
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard
                title="Total Clients"
                value={totalClients}
                icon={Users}
                color="blue"
                trend={{ value: 8.3, isPositive: true }}
              />
              <StatCard
                title="Active Clients"
                value={activeClients}
                icon={CheckCircle}
                color="green"
                subtitle={`${Math.round((activeClients / totalClients) * 100)}% of total`}
              />
            </div>
          )}
        </div>

        {/* Connections Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
            <Zap className="w-6 h-6" />
            <span>Connections Overview</span>
          </h2>
          {totalConnections === 0 ? (
            <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 text-center">
              <p className="text-gray-400 mb-4">No connections found. Create a new connection to get started.</p>
              <Link href="http://localhost:3000/connections/new" passHref>
                <button className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors">
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Create Connection
                </button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard
                  title="Total Connections"
                  value={totalConnections}
                  icon={Zap}
                  color="orange"
                  trend={{ value: 12.1, isPositive: true }}
                />
                <StatCard
                  title="Enabled Connections"
                  value={enabledConnections}
                  icon={Play}
                  color="green"
                  subtitle={`${Math.round((enabledConnections / totalConnections) * 100)}% enabled`}
                />
                <StatCard title="Active Connections" value={connectionsByStatus.active} icon={CheckCircle} color="green" />
                <StatCard title="Error Connections" value={connectionsByStatus.error} icon={XCircle} color="red" />
              </div>

              {/* Data Source Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
                  <h3 className="text-lg font-semibold text-orange-400 mb-4">By Data Source</h3>
                  <div className="space-y-3">
                    {Object.entries(connectionsByDataSource).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg">
                        <span className="text-white">{source}</span>
                        <span className="text-orange-400 font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
                  <h3 className="text-lg font-semibold text-orange-400 mb-4">Status Distribution</h3>
                  <div className="flex items-center justify-center">
                    <DonutChart data={connectionsByStatus} size={200} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Queries Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
            <Database className="w-6 h-6" />
            <span>Queries Overview</span>
          </h2>
          {totalQueries === 0 ? (
            <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 text-center">
              <p className="text-gray-400 mb-4">No queries found. Define your first query to analyze data.</p>
              <Link href="http://localhost:3000/queries/new" passHref>
                <button className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors">
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Create Query
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Total Queries"
                value={totalQueries}
                icon={Database}
                color="blue"
                trend={{ value: 15.7, isPositive: true }}
              />
              {Object.entries(queriesBySchedule).map(([type, count]) => (
                <StatCard
                  key={type}
                  title={`${type} Queries`}
                  value={count}
                  icon={type === "Scheduled" ? Calendar : FileText}
                  color={type === "Scheduled" ? "green" : "orange"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Connection Activity */}
          <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-orange-400">Recent Connection Activity</h3>
                </div>
                {errorConnections.length > 0 && (
                  <div className="flex items-center space-x-1 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">{errorConnections.length} errors</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-orange-500/50 custom-scrollbar">
                {data.recentConnectionExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className={`p-4 rounded-lg border ${
                      execution.status === "FAILED"
                        ? "bg-red-900/20 border-red-500/30"
                        : execution.status === "SUCCESS"
                          ? "bg-green-900/20 border-green-500/30"
                          : execution.status === "RUNNING"
                            ? "bg-blue-900/20 border-blue-500/30"
                            : "bg-gray-900/30 border-gray-700/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {execution.status === "SUCCESS" && <CheckCircle className="w-4 h-4 text-green-400" />}
                        {execution.status === "FAILED" && <XCircle className="w-4 h-4 text-red-400" />}
                        {execution.status === "RUNNING" && <Activity className="w-4 h-4 text-blue-400 animate-spin" />}
                        {execution.status === "PENDING" && <Pause className="w-4 h-4 text-orange-400" />}
                        <span className="text-white font-medium">Connection Execution #{execution.id}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(execution.started_at).toLocaleString()}</span>
                    </div>

                    <p className="text-gray-300 text-sm mb-2">{execution.message}</p>

                    {execution.triggered_by && (
                      <div className="text-xs text-gray-400">Triggered by: {execution.triggered_by.username}</div>
                    )}
                    {!execution.triggered_by && <div className="text-xs text-gray-400">System triggered</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Query Activity */}
          <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-orange-400">Recent Query Activity</h3>
                </div>
                {errorQueries.length > 0 && (
                  <div className="flex items-center space-x-1 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">{errorQueries.length} errors</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-orange-500/50 custom-scrollbar">
                {data.recentQueryExecutions.map((execution) => {
                  // 找到對應的查詢定義
                  const query = data.queries.find((q) => q.id === execution.query)
                  return (
                    <div
                      key={execution.id}
                      className={`p-4 rounded-lg border ${
                        execution.status === "FAILED"
                          ? "bg-red-900/20 border-red-500/30"
                          : "bg-green-900/20 border-green-500/30"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {execution.status === "SUCCESS" && <CheckCircle className="w-4 h-4 text-green-400" />}
                          {execution.status === "FAILED" && <XCircle className="w-4 h-4 text-red-400" />}
                          <span className="text-white font-medium">{query?.name || `Query #${execution.query}`}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(execution.executed_at).toLocaleString()}
                        </span>
                      </div>

                      {execution.status === "FAILED" && execution.error_message && (
                        <p className="text-red-300 text-sm mb-2">{execution.error_message}</p>
                      )}

                      {execution.status === "SUCCESS" && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">
                            {execution.result_rows_count?.toLocaleString()} rows processed
                          </span>
                          {execution.result_output_link && (
                            <a
                              href={execution.result_output_link}
                              className="flex items-center space-x-1 text-orange-400 hover:text-orange-300"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View Result</span>
                            </a>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mt-2">Triggered by: {execution.triggered_by}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}