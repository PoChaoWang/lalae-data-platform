// /frontend/src/app/connections/[connectionId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CloneConnectionButton from '@/components/connections/CloneConnectionButton'; 
import DeleteConnectionModal from '@/components/connections/DeleteConnectionModal';
import { Connection } from '@/lib/definitions';

// ✨ 導入所有需要的 UI 元件和圖示
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Zap, ChevronDown, Settings, Trash2, Loader2, AlertCircle } from "lucide-react";

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connectionId;
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // 1. 擴充 State 來管理整個表單
  const [isEnabled, setIsEnabled] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState('daily');
  const [syncHour, setSyncHour] = useState('00');
  const [syncMinute, setSyncMinute] = useState('00');
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState('1');
  const [monthlyDayOfMonth, setMonthlyDayOfMonth] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!connectionId) return;

    const fetchDataAndToken = async () => {
      setLoading(true);
      setError(null); // 在開始請求前重置錯誤狀態

      try {
        // ✨ 使用 Promise.all 同時發起兩個請求
        const [connRes, csrfRes] = await Promise.all([
          fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/`, { credentials: 'include' }),
          fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/get-csrf-token/`, { credentials: 'include' })
        ]);

        if (!connRes.ok) throw new Error('Failed to fetch connection details.');
        if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token.');

        const connData: Connection = await connRes.json();
        const csrfData = await csrfRes.json();

        // 設定連線資料
        setConnection(connData);
        // ✨ 將從 API 獲取的 Token 存入 state
        setCsrfToken(csrfData.csrfToken); 

        // 初始化表單 state (這部分不變)
        setIsEnabled(connData.is_enabled);
        setSyncFrequency(connData.config?.sync_frequency || 'daily');
        setSyncHour(connData.config?.sync_hour || '00');
        setSyncMinute(connData.config?.sync_minute || '00');
        setWeeklyDayOfWeek(connData.config?.weekly_day_of_week || '1');
        setMonthlyDayOfMonth(connData.config?.monthly_day_of_month || 1);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDataAndToken();
  }, [connectionId]);

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateMessage(null);

    if (!csrfToken) {
      setUpdateMessage({ type: 'error', text: 'Security token is missing. Cannot update.' });
      setIsUpdating(false);
      return;
    }

    const payload = {
      is_enabled: isEnabled,
      config: {
        ...connection?.config, // 保留現有的 config
        sync_frequency: syncFrequency,
        sync_hour: syncHour,
        sync_minute: syncMinute,
        weekly_day_of_week: weeklyDayOfWeek,
        monthly_day_of_month: monthlyDayOfMonth,
      }
    };
    
    // Django REST Framework 的 ModelViewSet 預設就支援 PATCH
    try {
      const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData) || 'Failed to update connection.');
      }

      const updatedConnection = await res.json();
      setConnection(updatedConnection); // 更新頁面上的資料
      setUpdateMessage({ type: 'success', text: 'Connection updated successfully!' });

    } catch (err: any) {
      setUpdateMessage({ type: 'error', text: err.message });
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }
  
  if (error || !connection) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
          <Alert variant="destructive" className="max-w-lg bg-red-900/50 border-red-500/50 text-red-300">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || "Connection not found."}</AlertDescription>
          </Alert>
      </div>
    );
  }

  return (
    <div className="relative z-10 max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
            <Link href="/connections" className="flex items-center space-x-2 text-gray-400 hover:text-orange-400 transition-colors duration-300 group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                <span>Back to Connections</span>
            </Link>
        </div>

        {/* Section 1: Connection Details */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-orange-400 mb-6 flex items-center space-x-2"><Zap className="w-6 h-6" /><span>Connection Details</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <div className="overflow-hidden">
                  <Label className="text-gray-400 text-sm">Connection Name</Label>
                  <div className="mt-1 text-xl font-semibold break-words">{connection.display_name}</div>
                </div>
                <div><Label className="text-gray-400 text-sm">Data Source</Label><div className="mt-1 font-medium">{connection.data_source.display_name}</div></div>
                <div className="overflow-hidden">
                  <Label className="text-gray-400 text-sm">Dataset ID</Label>
                  <div className="mt-1"><code className="bg-gray-900/50 text-orange-300 px-3 py-2 rounded-md font-mono break-all">{connection.target_dataset_id}</code></div>
                </div>
                <div><Label className="text-gray-400 text-sm">Status</Label><div className={`mt-1 font-semibold ${connection.is_enabled ? "text-green-400" : "text-gray-400"}`}>{connection.is_enabled ? 'Active' : 'Inactive'}</div></div>
            </div>
            <Collapsible className="mt-6">
                <CollapsibleTrigger className="flex items-center text-orange-400 text-sm"><ChevronDown className="w-4 h-4 mr-1" /><span>View Full Configuration</span></CollapsibleTrigger>
                <CollapsibleContent className="mt-4 bg-gray-900/50 rounded-lg p-4"><pre className="text-sm text-gray-300 overflow-auto"><code>{JSON.stringify(connection.config, null, 2)}</code></pre></CollapsibleContent>
            </Collapsible>
        </div>

        {/* Section 2: Update Settings */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-orange-400 mb-6 flex items-center space-x-2"><Settings className="w-6 h-6" /><span>Update Settings</span></h2>
            <form onSubmit={handleUpdateSchedule} className="space-y-6">
                {updateMessage && (
                    <Alert variant={updateMessage.type === 'error' ? 'destructive' : 'default'} className={updateMessage.type === 'success' ? 'bg-green-900/50 border-green-500/50 text-green-300' : ''}>
                        <AlertTitle>{updateMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                        <AlertDescription>{updateMessage.text}</AlertDescription>
                    </Alert>
                )}
                <div>
                    <Label className="text-white font-medium">Connection Status</Label>
                    <div className="flex items-center space-x-2">
                        <div className="inline-flex bg-gray-700/50 rounded-lg p-1">
                            <button type="button" onClick={() => setIsEnabled(false)} className={`px-4 py-1 text-sm rounded-md transition-colors ${!isEnabled ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-gray-600/50'}`}>
                                OFF
                            </button>
                            <button type="button" onClick={() => setIsEnabled(true)} className={`px-4 py-1 text-sm rounded-md transition-colors ${isEnabled ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-gray-600/50'}`}>
                                ON
                            </button>
                        </div>
                        <span className="text-gray-400 text-sm">If OFF, this connection will not sync data.</span>
                    </div>
                </div>
                <div>
                    <Label className="text-white font-medium">Sync Frequency</Label>
                    <div className="mt-2 flex space-x-2">
                        {["once", "daily", "weekly", "monthly"].map((freq) => (
                            <button key={freq} type="button" onClick={() => setSyncFrequency(freq)}
                                className={`px-4 py-2 rounded-lg border transition-all duration-300 capitalize ${syncFrequency === freq ? "bg-orange-500 text-black border-orange-500" : "bg-gray-800 text-gray-300 border-gray-600 hover:border-orange-500/50"}`}>
                                {freq}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-white font-medium">Hour</Label>
                        <Input type="number" min="0" max="23" value={syncHour} onChange={(e) => setSyncHour(e.target.value)} className="mt-2 bg-gray-900/50 border-gray-600/50"/>
                    </div>
                    <div>
                        <Label className="text-white font-medium">Minute</Label>
                        <Input type="number" min="0" max="59" value={syncMinute} onChange={(e) => setSyncMinute(e.target.value)} className="mt-2 bg-gray-900/50 border-gray-600/50"/>
                    </div>
                </div>
                {syncFrequency === 'weekly' && (
                    <div>
                        <Label className="text-white font-medium">Day of Week</Label>
                        <Select value={weeklyDayOfWeek} onValueChange={setWeeklyDayOfWeek}>
                          <SelectTrigger className="mt-2 bg-gray-900/50 border-gray-600/50"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="1">Monday</SelectItem><SelectItem value="2">Tuesday</SelectItem><SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem><SelectItem value="5">Friday</SelectItem><SelectItem value="6">Saturday</SelectItem>
                            <SelectItem value="0">Sunday</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>
                )}
                {syncFrequency === 'monthly' && (
                    <div>
                        <Label className="text-white font-medium">Day of Month</Label>
                        <Input type="number" min="1" max="31" value={monthlyDayOfMonth} onChange={(e) => setMonthlyDayOfMonth(parseInt(e.target.value, 10))} className="mt-2 bg-gray-900/50 border-gray-600/50 max-w-32"/>
                    </div>
                )}
                <Button type="submit" disabled={isUpdating} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold">
                    {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isUpdating ? "Updating..." : "Update Schedule"}
                </Button>
            </form>
        </div>

        {/* Section 3: Actions */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-orange-400 mb-6">Actions</h2>
            <div className="flex space-x-4">
                <CloneConnectionButton connectionId={connection.id} />
                <Button onClick={() => setIsDeleteModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Connection
                </Button>
            </div>
        </div>

        {/* The Modal */}
        <DeleteConnectionModal 
            isOpen={isDeleteModalOpen} 
            onClose={() => setIsDeleteModalOpen(false)}
            connectionId={connection.id}
            connectionName={connection.display_name}
            csrfToken={csrfToken}
        />
    </div>
  );
}