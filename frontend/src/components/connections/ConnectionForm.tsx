// /components/connections/ConnectionForm.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import GoogleAdsFields from './GoogleAdsFields';
import FacebookAdsFields from './FacebookAdsFields';
import GoogleSheetFields from './GoogleSheetFields';
import type { SelectableClient, DataSource, LinkedSocialAccount } from '@/lib/definitions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Clock, Zap, LogIn } from "lucide-react";
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';
import { signIn } from 'next-auth/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

type AuthStatus = 'loading' | 'authorized' | 'not-authorized';

export default function ConnectionForm({ client, dataSource, initialData }: { client: SelectableClient; dataSource: DataSource; initialData?: { displayName: string; config: any; social_account_id?: string | null } | null }) {
  const { protectedFetch } = useProtectedFetch();
  const router = useRouter();
  const pathname = usePathname(); 
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // authStatus 現在將用於判斷當前選中的 social_account 狀態
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authIdentifier, setAuthIdentifier] = useState<string>('');
  
  // 新增狀態來儲存已連結的 social accounts
  const [linkedSocialAccounts, setLinkedSocialAccounts] = useState<LinkedSocialAccount[]>([]);
  // 新增狀態來儲存當前選中的 social account ID
  const [selectedSocialAccountId, setSelectedSocialAccountId] = useState<string | null>(initialData?.social_account_id || null);


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
    const fetchLinkedAccounts = async () => {
      if (!protectedFetch) return;
      if (dataSource.name !== 'GOOGLE_ADS' && dataSource.name !== 'FACEBOOK_ADS') {
        setAuthStatus('authorized'); // 對於不需要 OAuth 的資料源，直接設置為已授權
        return;
      }

      setAuthStatus('loading'); // 開始加載時設置為 loading
      try {
        const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/${client.id}/social_accounts/`);
        if (!res.ok) throw new Error('Failed to fetch linked social accounts');
        
        const data: LinkedSocialAccount[] = await res.json();
        const filteredData = data.filter(acc => acc.provider.toLowerCase() === dataSource.name.toLowerCase().replace('_ads', ''));
        setLinkedSocialAccounts(filteredData);
        // 如果有傳入 initialData 且包含 social_account_id，則嘗試選中它
        if (initialData?.social_account_id) {
          const preSelected = filteredData.find(acc => acc.id === initialData.social_account_id);
          if (preSelected) {
            setSelectedSocialAccountId(preSelected.id);
            setAuthIdentifier(preSelected.email || preSelected.name);
            setAuthStatus(preSelected.is_authorized ? 'authorized' : 'not-authorized');
          } else {
            // 如果 initialData 中的 ID 不在列表中，可能需要重新授權或提示
            setSelectedSocialAccountId(null);
            setAuthStatus('not-authorized');
            setAuthIdentifier('');
          }
        } else if (filteredData.length > 0) {
          // 如果沒有 initialData 或 initialData 不包含 social_account_id，預設選擇第一個有效帳號
          const firstAuthorized = filteredData.find(acc => acc.is_authorized) || filteredData[0];
          setSelectedSocialAccountId(firstAuthorized.id);
          setAuthIdentifier(firstAuthorized.email || firstAuthorized.name);
          setAuthStatus(firstAuthorized.is_authorized ? 'authorized' : 'not-authorized');
        } else {
          // 如果沒有任何已連結帳號
          setSelectedSocialAccountId(null);
          setAuthStatus('not-authorized');
          setAuthIdentifier('');
        }
      } catch (e: any) {
        setError(`Failed to load authorization data: ${e.message}`);
        setAuthStatus('not-authorized');
        setAuthIdentifier('');
        setLinkedSocialAccounts([]);
        setSelectedSocialAccountId(null);
      }
    };
    fetchLinkedAccounts();
  }, [client.id, dataSource.name, protectedFetch, initialData?.social_account_id]); // 添加 initialData?.social_account_id 到依賴項

  // 當 selectedSocialAccountId 改變時，更新 authStatus 和 authIdentifier
  useEffect(() => {
    const currentSelectedAccount = linkedSocialAccounts.find(acc => acc.id === selectedSocialAccountId);
    if (currentSelectedAccount) {
      setAuthIdentifier(currentSelectedAccount.email || currentSelectedAccount.name);
      setAuthStatus(currentSelectedAccount.is_authorized ? 'authorized' : 'not-authorized');
    } else {
      setAuthIdentifier('');
      // 如果沒有選中帳號，或者選中的帳號不在列表裡了，就顯示 Not authorized
      setAuthStatus('not-authorized'); 
    }
  }, [selectedSocialAccountId, linkedSocialAccounts]);


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
    if ((dataSource.name === 'GOOGLE_ADS' || dataSource.name === 'FACEBOOK_ADS') && (authStatus !== 'authorized' || !selectedSocialAccountId)) {
      setError('Please authorize and select an account before creating the connection.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const payload = {
      display_name: formData.display_name,
      target_dataset_id: formData.target_dataset_id,
      client_id: client.id,
      data_source_id: dataSource.id,
      social_account_id: selectedSocialAccountId, // 將選中的 social_account_id 傳遞給後端
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
    const providerIconClass = dataSource.name === 'GOOGLE_ADS' ? 'bi-google' : 'bi-facebook';
  
    return (
      <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Authorization Status</span>
            </h3>
            
            {linkedSocialAccounts.length > 0 && (
              <div className="mb-4">
                <Label htmlFor="social_account_select" className="text-white font-medium mb-2 block">
                  Select {providerName} Account:
                </Label>
                <Select
                  value={selectedSocialAccountId || ''}
                  onValueChange={(value) => setSelectedSocialAccountId(value)}
                  disabled={linkedSocialAccounts.length === 0} 
                >
                  <SelectTrigger className="w-full bg-gray-900/50 border-gray-600/50 text-white">
                    <SelectValue placeholder={`Select a ${providerName} account`} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {linkedSocialAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name || account.email} {account.is_authorized ? "(Authorized)" : "(Not Authorized)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSocialAccountId && !linkedSocialAccounts.find(acc => acc.id === selectedSocialAccountId)?.is_authorized && (
                  <p className="text-red-400 text-sm mt-2">The selected account is not authorized. Please re-authorize or select another account.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
                {selectedSocialAccountId ? (
                  linkedSocialAccounts.find(acc => acc.id === selectedSocialAccountId)?.is_authorized ? (
                    <span className="text-green-400">Authorized as: {authIdentifier}</span>
                  ) : (
                    <span className="text-red-400">Not authorized: {authIdentifier}</span>
                  )
                ) : (
                  <span className="text-red-400">No {providerName} account selected or authorized.</span>
                )}
                
                <Button 
                  onClick={handleAuthorize} 
                  className="bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                  type="button"
                >
                    <LogIn className="w-4 h-4 mr-2" />
                    {selectedSocialAccountId ? 'Re-authorize' : 'Authorize New'} {providerName} Account
                </Button>
            </div>
        </div>
    );
  };


  return (
    <form onSubmit={handleSubmit}>
        <div className="space-y-8">
            {error && <div className="bg-red-900/50 text-red-300 border border-red-500/50 rounded-lg p-4">{error}</div>}

            {(dataSource.name === 'GOOGLE_ADS' || dataSource.name === 'FACEBOOK_ADS') && renderAuthCard()}


          {/* Please remove the following note after pass the test */}  
            {/* Google Ads Specific Note */}
            {dataSource.name === 'GOOGLE_ADS' && (
                <div className="bg-blue-900/50 text-blue-300 border border-blue-500/50 rounded-lg p-4 mt-4">
                    <p><strong>Note for Google Ads:</strong> Due to the current developer token's access level, this connection might only be able to fetch data from <a href="https://developers.google.com/google-ads/api/docs/best-practices/test-accounts" target="_blank" rel="noopener noreferrer" className="underline">Google Ads test accounts</a>. Full data access from live production accounts requires a higher access level for the developer token, which is currently undergoing review. We appreciate your understanding.</p>
                </div>
            )}

            {/* Facebook Ads Specific Note */}
            {dataSource.name === 'FACEBOOK_ADS' && (
                <div className="bg-blue-900/50 text-blue-300 border border-blue-500/50 rounded-lg p-4 mt-4">
                    <p><strong>Note for Facebook Ads:</strong> Data retrieval from Facebook Ads requires a valid and active advertising account with appropriate permissions. We are actively working to confirm full data fetching capabilities with various account types. Your patience is appreciated.</p>
                </div>
            )}
          {/* Please remove the following note after pass the test */}  

          
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
            {dataSource.name === 'FACEBOOK_ADS' && <FacebookAdsFields onConfigChange={handleConfigChange} client={client} initialConfig={formData.config} selectedSocialAccountId={selectedSocialAccountId}/>}
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
