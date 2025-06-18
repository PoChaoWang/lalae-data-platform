// /components/connections/ConnectionForm.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import GoogleAdsFields from './GoogleAdsFields';
import FacebookAdsFields from './FacebookAdsFields';
import GoogleSheetFields from './GoogleSheetFields';
import type { SelectableClient, DataSource } from '@/lib/definitions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Clock, Zap, LogIn } from "lucide-react";
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

type AuthStatus = 'loading' | 'authorized' | 'not-authorized';

export default function ConnectionForm({ client, dataSource, initialData }: { client: SelectableClient; dataSource: DataSource; initialData?: { displayName: string; config: any; } | null }) {
  const { protectedFetch } = useProtectedFetch();
  const router = useRouter();
  const pathname = usePathname(); 
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authIdentifier, setAuthIdentifier] = useState<string>('');
  
  const [formData, setFormData] = useState({
    display_name: initialData?.displayName || '', 
    target_dataset_id: client.bigquery_dataset_id || '',
    sync_frequency: initialData?.config?.sync_frequency || 'Daily', 
    sync_hour: initialData?.config?.sync_hour || '00', 
    sync_minute: initialData?.config?.sync_minute || '00', 
    weekly_day_of_week: initialData?.config?.weekly_day_of_week || '1', 
    monthly_day_of_month: initialData?.config?.monthly_day_of_month || 1, 
    config: initialData?.config || {}, 
  });


  useEffect(() => {
    const checkAuthStatus = async () => {
      if (!protectedFetch) return;
      if (dataSource.name !== 'GOOGLE_ADS' && dataSource.name !== 'FACEBOOK_ADS') {
        setAuthStatus('authorized');
        return;
      }
      try {
        if (dataSource.name === 'GOOGLE_ADS') {
          const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/check-auth-status/?client_id=${client.id}`, { cache: 'no-store' });
          if (!res.ok) throw new Error('Failed to fetch auth status');
          const data = await res.json();
          setAuthStatus(data.is_authorized ? 'authorized' : 'not-authorized');
          if (data.is_authorized) setAuthIdentifier(data.email);
        } else if (dataSource.name === 'FACEBOOK_ADS') {
          if (client.facebook_social_account) {
            setAuthStatus('authorized');
            setAuthIdentifier(client.facebook_social_account.name);
          } else {
            setAuthStatus('not-authorized');
          }
        }
      } catch (e) {
        setAuthStatus('not-authorized');
      }
    };
    checkAuthStatus();
  }, [client, dataSource.name, protectedFetch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
  };

  const handleConfigChange = useCallback((configUpdate: object) => {
    setFormData(prev => ({ ...prev, config: { ...prev.config, ...configUpdate } }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protectedFetch) {
      setError("Authentication service unavailable.");
      return;
    }
    if (authStatus !== 'authorized') {
      setError('Please authorize the account before creating the connection.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const payload = {
      display_name: formData.display_name,
      target_dataset_id: formData.target_dataset_id,
      client_id: client.id,
      data_source_id: dataSource.id,
      config: { ...formData.config, sync_frequency: formData.sync_frequency, sync_hour: formData.sync_hour, sync_minute: formData.sync_minute, weekly_day_of_week: formData.weekly_day_of_week, monthly_day_of_month: formData.monthly_day_of_month },
    };
    try {
      const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        const errorMessages = Object.entries(errorData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
        throw new Error(errorMessages || 'Failed to create connection');
      }
      const newConnection = await res.json();
      router.push(`/connections/${newConnection.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthorize = () => {
    const fullPath = pathname + '?' + searchParams.toString();
    localStorage.setItem('oauth_redirect_path', fullPath);
    const authUrl = `${NEXT_PUBLIC_TO_BACKEND_URL}/connections/oauth/authorize/${client.id}/?data_source=${dataSource.name}&redirect_uri=${encodeURIComponent(fullPath)}`;    
    window.location.href = authUrl;
  };

  const renderAuthCard = () => {
    if (authStatus === 'loading') {
        return <div className="text-center p-4">Loading Authorization Status...</div>;
    }

    const isAuthorized = authStatus === 'authorized';
    const providerName = dataSource.name === 'GOOGLE_ADS' ? 'Google' : 'Facebook';
    const providerIcon = dataSource.name === 'GOOGLE_ADS' ? 'bi-google' : 'bi-facebook';
  
    return (
      <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Authorization Status</span>
            </h3>
            {isAuthorized ? (
                <div className="flex items-center justify-between">
                    <span className="text-green-400">Authorized as: {authIdentifier}</span>
                    <Button 
                      onClick={handleAuthorize} 
                      variant="outline" 
                      type="button"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                        Re-authorize
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <span className="text-red-400">Not authorized</span>
                    {/* ✨ 2. 使用 Button 元件並加入圖示 */}
                    <Button 
                      onClick={handleAuthorize} 
                      className="bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                      type="button"
                    >
                        <LogIn className="w-4 h-4 mr-2" />
                        Authorize {providerName} Account
                    </Button>
                </div>
            )}
        </div>
    );
  };

  return (
    <form onSubmit={handleSubmit}>
        <div className="space-y-8">
            {error && <div className="bg-red-900/50 text-red-300 border border-red-500/50 rounded-lg p-4">{error}</div>}

            {(dataSource.name === 'GOOGLE_ADS' || dataSource.name === 'FACEBOOK_ADS') && renderAuthCard()}

            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor='display_name' className="text-white font-medium">Connection Name *</Label>
                    <Input
                        id='display_name'
                        name='display_name'
                        value={formData.display_name}
                        onChange={handleInputChange}
                        placeholder="Enter connection name"
                        className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
                        required
                    />
                </div>
                <div>
                    <Label className="text-white font-medium">Target Dataset ID</Label>
                    <Input
                        value={formData.target_dataset_id}
                        readOnly
                        className="mt-2 bg-gray-700/50 border-gray-600/50 text-gray-400"
                    />
                </div>
            </div>

            {/* Data Source Specific Fields */}
            {dataSource.name === 'GOOGLE_ADS' && <GoogleAdsFields onConfigChange={handleConfigChange} client={client} initialConfig={formData.config}/>}
            {dataSource.name === 'FACEBOOK_ADS' && <FacebookAdsFields onConfigChange={handleConfigChange} client={client} initialConfig={formData.config}/>}
            {dataSource.name === 'GOOGLE_SHEET' && <GoogleSheetFields onConfigChange={handleConfigChange} initialConfig={formData.config} />}

            {/* Sync Schedule */}
            <div className="border-t border-gray-700/50 pt-6">
                <h3 className="text-orange-400 font-semibold mb-4 flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Sync Schedule</span>
                </h3>
                <div className="space-y-4">
                    <div>
                        <Label className="text-white font-medium">Frequency</Label>
                        <div className="mt-2 flex space-x-2">
                            {["Once", "Daily", "Weekly", "Monthly"].map((freq) => (
                                <button
                                    key={freq}
                                    type="button"
                                    onClick={() => setFormData(prev => ({...prev, sync_frequency: freq}))}
                                    className={`px-4 py-2 rounded-lg border transition-all duration-300 ${
                                        formData.sync_frequency === freq
                                            ? "bg-orange-500 text-black border-orange-500"
                                            : "bg-gray-800 text-gray-300 border-gray-600 hover:border-orange-500/50"
                                    }`}
                                >
                                    {freq}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* ✨ 新增：當頻率為 Weekly 時顯示星期選擇 */}
                    {formData.sync_frequency === 'Weekly' && (
                        <div>
                            <Label htmlFor="weekly_day_of_week" className="text-white font-medium">Day of Week</Label>
                            <select
                                id="weekly_day_of_week"
                                name="weekly_day_of_week"
                                value={formData.weekly_day_of_week}
                                onChange={handleInputChange}
                                className="mt-2 block w-full rounded-lg border-gray-600/50 bg-gray-900/50 text-white focus:border-orange-500 focus:ring-orange-500"
                            >
                                <option value="1">Monday</option>
                                <option value="2">Tuesday</option>
                                <option value="3">Wednesday</option>
                                <option value="4">Thursday</option>
                                <option value="5">Friday</option>
                                <option value="6">Saturday</option>
                                <option value="0">Sunday</option>
                            </select>
                        </div>
                    )}

                    {/* ✨ 新增：當頻率為 Monthly 時顯示日期選擇 */}
                    {formData.sync_frequency === 'Monthly' && (
                        <div>
                            <Label htmlFor="monthly_day_of_month" className="text-white font-medium">Day of Month</Label>
                            <Input
                                id="monthly_day_of_month"
                                name="monthly_day_of_month"
                                type="number"
                                min="1"
                                max="31"
                                value={formData.monthly_day_of_month}
                                onChange={handleInputChange}
                                className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-white font-medium">Hour (0-23)</Label>
                            <Input
                                name="sync_hour"
                                type="number"
                                min="0" max="23"
                                value={formData.sync_hour}
                                onChange={handleInputChange}
                                className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
                            />
                        </div>
                        <div>
                            <Label className="text-white font-medium">Minute (0-59)</Label>
                            <Input
                                name="sync_minute"
                                type="number"
                                min="0" max="59"
                                value={formData.sync_minute}
                                onChange={handleInputChange}
                                className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>


            {/* Create Button */}
            <div className="pt-6 border-t border-gray-700/50">
                <Button
                    type="submit"
                    disabled={isSubmitting || !formData.display_name}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-4 text-lg rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Zap className="w-5 h-5 mr-2" />
                    {isSubmitting ? 'Creating...' : 'Create Connection'}
                </Button>
            </div>
        </div>
    </form>
  );
}
