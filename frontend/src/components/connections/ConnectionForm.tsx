// /components/connections/ConnectionForm.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import GoogleAdsFields from './GoogleAdsFields';
import FacebookAdsFields from './FacebookAdsFields';
import GoogleSheetFields from './GoogleSheetFields';
import type { SelectableClient, DataSource } from '@/lib/definitions';
import { getCookie } from '@/lib/utils';


// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

type AuthStatus = 'loading' | 'authorized' | 'not-authorized';

export default function ConnectionForm({ client, dataSource }: { client: SelectableClient; dataSource: DataSource; }) {
  const router = useRouter();
  const pathname = usePathname(); 
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authIdentifier, setAuthIdentifier] = useState<string>('');
  
  const [formData, setFormData] = useState(() => {
    // 嘗試從 URL 參數中解析資料
    const clonedConfigString = searchParams.get('config');
    const clonedConfig = clonedConfigString ? JSON.parse(clonedConfigString) : {};

    const displayName = searchParams.get('display_name') || '';

    return {
      display_name: displayName,
      target_dataset_id: client.bigquery_dataset_id || '',
      sync_frequency: clonedConfig.sync_frequency || 'daily',
      sync_hour: clonedConfig.sync_hour || '00',
      sync_minute: clonedConfig.sync_minute || '00',
      weekly_day_of_week: clonedConfig.weekly_day_of_week || '1',
      monthly_day_of_month: clonedConfig.monthly_day_of_month || 1,
      config: clonedConfig, 
    };
  });

  useEffect(() => {
    const cloneFromId = searchParams.get('cloneFrom');
    if (cloneFromId) {
      const fetchConnectionToClone = async (id: string) => {
        try {
          const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${id}/`, {
            credentials: 'include',
          });
          if (!res.ok) {
            throw new Error(`Failed to fetch connection data (ID: ${id}) for cloning.`);
          }
          const connectionToClone = await res.json();

          // 使用獲取到的資料來設定表單的初始值
          setFormData(prev => ({
            ...prev,
            display_name: `${connectionToClone.display_name} (Copy)`,
            // Sync schedule
            sync_frequency: connectionToClone.config.sync_frequency || 'daily',
            sync_hour: connectionToClone.config.sync_hour || '00',
            sync_minute: connectionToClone.config.sync_minute || '00',
            weekly_day_of_week: connectionToClone.config.weekly_day_of_week || '1',
            monthly_day_of_month: connectionToClone.config.monthly_day_of_month || 1,
            // 最重要的部分：將獲取到的 config 設定到 state 中
            config: connectionToClone.config || {},
          }));

        } catch (err: any) {
          console.error(err);
          setError(`Could not load data for cloning: ${err.message}`);
        }
      };
      fetchConnectionToClone(cloneFromId);
    }
  }, [searchParams]); 

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/get-csrf-token/`, {
          credentials: 'include', // 確保 sessionid cookie 被發送，Django 才能生成對應的 CSRF token
        });
        if (!res.ok) throw new Error('Failed to fetch CSRF token');
        const data = await res.json();
        setCsrfToken(data.csrfToken); // 將 token 存入 state
      } catch (e) {
        console.error("Could not fetch CSRF token:", e);
        setError("Could not initialize security token. Please refresh the page.");
      }
    };

    fetchCsrfToken();
  }, []);

  useEffect(() => {
    const checkAuthStatus = async () => {
      // 如果不是需要 OAuth 的資料源，則直接設為已授權
      if (dataSource.name !== 'GOOGLE_ADS' && dataSource.name !== 'FACEBOOK_ADS') {
        setAuthStatus('authorized');
        return;
      }
      
      if (dataSource.name === 'GOOGLE_ADS') {
        try {
          const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/check-auth-status/?client_id=${client.id}`, { 
            credentials: 'include',
            cache: 'no-store' 
          });
          if (!res.ok) throw new Error('Failed to fetch auth status');
          const data = await res.json();
          if (data.is_authorized) {
            setAuthStatus('authorized');
            setAuthIdentifier(data.email);
          } else {
            setAuthStatus('not-authorized');
          }
        } catch (e) {
          console.error(e);
          setAuthStatus('not-authorized');
        }
      } else if (dataSource.name === 'FACEBOOK_ADS') {
        // Facebook 的狀態可以直接從 client 物件判斷 (假設它被傳遞了)
        // 這需要確保載入頁面的 API 有回傳 client.facebook_social_account
        if (client.facebook_social_account) {
            setAuthStatus('authorized');
            // 'extra_data' 的結構可能需要調整
            setAuthIdentifier(client.facebook_social_account.name);
        } else {
            setAuthStatus('not-authorized');
        }
      }
    };
    checkAuthStatus();
  }, [client.id, client.facebook_social_account, dataSource.name]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // ✨ 使用 useCallback 將此函式實例固定下來，除非依賴項改變
  // 這是解決方案的核心
  const handleConfigChange = useCallback((configUpdate: object) => {
    setFormData(prev => ({ 
      ...prev, 
      config: { ...prev.config, ...configUpdate } 
  }));
}, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (authStatus !== 'authorized') {
      setError('Please authorize the account before creating the connection.');
      window.scrollTo(0, 0);
      return;
    }

    if (!csrfToken) {
      setError("Security token is missing. Cannot submit the form.");
      setIsSubmitting(false);
      return;
    }
    
    const headers = new Headers({
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken // 使用 state 中的 token
    });
    
    const payload = {
        display_name: formData.display_name,
        target_dataset_id: formData.target_dataset_id,
        client_id: client.id,
        data_source_id: dataSource.id,
        config: {
            ...formData.config,
            sync_frequency: formData.sync_frequency,
            sync_hour: formData.sync_hour,
            sync_minute: formData.sync_minute,
            weekly_day_of_week: formData.weekly_day_of_week,
            monthly_day_of_month: formData.monthly_day_of_month,
        }
    };

    // const csrfToken = getCookie('csrftoken'); 
    // console.log('CSRF Token from cookie:', csrfToken);
    // const headers = new Headers({
    //     'Content-Type': 'application/json'
    // });
    // if (csrfToken) {
    //     headers.append('X-CSRFToken', csrfToken); // 2. 將 Token 加入 Header
    // } else {
    //     setError("CSRF token not found. Please ensure you are logged in and cookies are enabled.");
    //     setIsSubmitting(false);
    //     return;
    // }

    try {
      const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 403) {
             throw new Error('CSRF Verification Failed. Please refresh the page and try again.');
        }
        const errorMessages = Object.entries(errorData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
        throw new Error(errorMessages || 'Failed to create connection');
      }

      const newConnection = await res.json();
      router.push(`/connections/${newConnection.id}`);
    } catch (err: any) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthorize = () => {
    const fullPath = pathname + '?' + searchParams.toString();
    localStorage.setItem('oauth_redirect_path', fullPath);
    
    const authUrl = `${NEXT_PUBLIC_TO_BACKEND_URL}/connections/oauth/authorize/${client.id}?data_source=${dataSource.name}`;
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
      <div className="mb-4">
          <div className="card">
              <div className="card-body">
                  <h5 className="card-title">{providerName} Authorization Status</h5>
                  <div className="oauth-status mb-3">
                      {isAuthorized ? (
                          <div className="alert alert-success">
                              <i className="bi bi-check-circle"></i> Authorized as: {authIdentifier}
                          </div>
                      ) : (
                          <>
                              <div className="alert alert-warning">
                                  <i className="bi bi-exclamation-triangle"></i> Not authorized
                              </div>
                              <div className="alert alert-info mt-3">
                                  <i className="bi bi-info-circle"></i>
                                  <strong>OAuth Authentication Required:</strong> You need to authorize access to your {providerName} account.
                              </div>
                          </>
                      )}
                  </div>
                  {/* ✨ 不再使用 <a> 標籤的 href，而是統一用 onClick 觸發我們的函式 */}
                  <button 
                    type="button"
                    onClick={handleAuthorize} 
                    className={`btn ${isAuthorized ? 'btn-outline-primary' : 'btn-primary'}`}
                  >
                      <i className={`bi ${isAuthorized ? 'bi-arrow-clockwise' : providerIcon}`}></i>
                      {isAuthorized ? ` Re-authorize ${providerName} Account` : ` Authorize ${providerName} Account`}
                  </button>
              </div>
          </div>
      </div>
    );
  };

  // JSX 部分維持不變
  return (
    <div className="row justify-content-center">
        <div className="col-md-8">
            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        {error && <div className="alert alert-danger">{error}</div>}
                        {(dataSource.name === 'GOOGLE_ADS' || dataSource.name === 'FACEBOOK_ADS') && renderAuthCard()}
                        
                        <div className="mb-3">
                            <label htmlFor="display_name" className="form-label">Connection Name</label>
                            <input id="display_name" name="display_name" value={formData.display_name} onChange={handleInputChange} className="form-control" required />
                        </div>

                        <div className="mb-3">
                            <label htmlFor="target_dataset_id" className="form-label">Target Dataset ID</label>
                            <input id="target_dataset_id" name="target_dataset_id" value={formData.target_dataset_id} className="form-control" readOnly />
                            <div className="form-text">This is the dataset where your data will be stored.</div>
                        </div>
                        
                        {dataSource.name === 'GOOGLE_ADS' && <GoogleAdsFields onConfigChange={handleConfigChange} client={client}  initialConfig={formData.config}/>}
                        {dataSource.name === 'FACEBOOK_ADS' && <FacebookAdsFields onConfigChange={handleConfigChange} client={client}  initialConfig={formData.config}/>}
                        {dataSource.name === 'GOOGLE_SHEET' && <GoogleSheetFields onConfigChange={handleConfigChange} initialConfig={formData.config} />}
                        
                        <hr className="my-4" />
                        
                        <h5 className="mb-3">Sync Schedule</h5>
                         {/* ...剩餘的 JSX ... */}
                         <div className="mb-3">
                            <div className="row align-items-end">
                                <div className="col-md-3">
                                    <label htmlFor="sync_frequency" className="form-label">Sync Frequency</label>
                                    <select id="sync_frequency" name="sync_frequency" value={formData.sync_frequency} onChange={handleInputChange} className="form-select">
                                        <option value="once">Once</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div className="col-md-3">
                                    <label htmlFor="sync_hour" className="form-label">Hour (24h)</label>
                                    <select id="sync_hour" name="sync_hour" value={formData.sync_hour} onChange={handleInputChange} className="form-select">
                                      {[...Array(24).keys()].map(h => <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-3">
                                    <label htmlFor="sync_minute" className="form-label">Minute</label>
                                     <select id="sync_minute" name="sync_minute" value={formData.sync_minute} onChange={handleInputChange} className="form-select">
                                        <option value="00">00</option><option value="15">15</option>
                                        <option value="30">30</option><option value="45">45</option>
                                     </select>
                                </div>
                            </div>
                        </div>
                        
                        {formData.sync_frequency === 'weekly' && (
                             <div className="mb-3">
                                <label htmlFor="weekly_day_of_week" className="form-label">Day of Week</label>
                                <select id="weekly_day_of_week" name="weekly_day_of_week" value={formData.weekly_day_of_week} onChange={handleInputChange} className="form-select">
                                    <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option>
                                    <option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option>
                                    <option value="0">Sunday</option>
                                </select>
                             </div>
                        )}
                        
                        {formData.sync_frequency === 'monthly' && (
                            <div className="mb-3">
                                <label htmlFor="monthly_day_of_month" className="form-label">Day of Month</label>
                                <input id="monthly_day_of_month" name="monthly_day_of_month" type="number" min="1" max="31" value={formData.monthly_day_of_month} onChange={handleInputChange} className="form-control" />
                            </div>
                        )}

                        <div className="d-grid gap-2 mt-4">
                            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                                {isSubmitting ? 'Creating...' : 'Create Connection'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
  );
}