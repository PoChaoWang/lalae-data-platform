// /components/connections/FacebookAdsFields.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import type { SelectableClient } from '@/lib/definitions';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

type AdAccount = { id: string; name: string };
type FBField = { name: string; label: string };
type AllFBFields = { [level: string]: { fields: FBField[], breakdowns: FBField[], action_breakdowns: FBField[] } };

async function getAdAccounts(clientId: string): Promise<AdAccount[]> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/facebook-ad-accounts/?client_id=${clientId}`, { credentials: 'include' });
    if (!res.ok) return [];
    return res.json();
}
async function getAllFacebookFields(): Promise<AllFBFields> {
    try {
        const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/facebook-all-fields/`, { credentials: 'include' });
        
        if (!res.ok) {
            // Log 更詳細的錯誤訊息
            console.error(`Failed to fetch Facebook fields: ${res.status} ${res.statusText}`);
            // 可以嘗試讀取錯誤回應的內文
            const errorBody = await res.text();
            console.error("Error body:", errorBody);
            return {}; // 或拋出錯誤
        }
        
        return res.json();
    } catch (error) {
        console.error("An error occurred during fetch:", error);
        return {}; // 或拋出錯誤
    }
}

export default function FacebookAdsFields({ onConfigChange, client, initialConfig }: { onConfigChange: (config: object) => void, client: SelectableClient, initialConfig?: any }) {
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [allFields, setAllFields] = useState<AllFBFields | null>(null);
    const [formState, setFormState] = useState(() => ({
        facebook_ad_account_id: initialConfig?.facebook_ad_account_id || '',
        insights_level: initialConfig?.insights_level || 'campaign',
        selected_fields: new Set<string>(initialConfig?.selected_fields || []),
        selected_breakdowns: new Set<string>(initialConfig?.selected_breakdowns || []),
        selected_action_breakdowns: new Set<string>(initialConfig?.selected_action_breakdowns || []),
    }));

    const onConfigChangeRef = useRef(onConfigChange);
    useEffect(() => {
        onConfigChangeRef.current = onConfigChange;
    }, [onConfigChange]);

    useEffect(() => {
        getAdAccounts(client.id).then(setAdAccounts);
        getAllFacebookFields().then(setAllFields);
    }, [client.id]);

    useEffect(() => {
        // 只有在複製資料存在，且廣告帳戶列表也載入完成後，才進行設定
        if (initialConfig && adAccounts.length > 0) {
            setFormState({
                facebook_ad_account_id: initialConfig.facebook_ad_account_id || '',
                insights_level: initialConfig.insights_level || 'campaign',
                selected_fields: new Set<string>(initialConfig.selected_fields || []),
                selected_breakdowns: new Set<string>(initialConfig.selected_breakdowns || []),
                // 注意：這裡的 key 可能是 action_breakdowns
                selected_action_breakdowns: new Set<string>(initialConfig.action_breakdowns || initialConfig.selected_action_breakdowns || []),
            });
        }
    }, [JSON.stringify(initialConfig), adAccounts]);

    useEffect(() => {
        // 使用 ref 來呼叫，避免 onConfigChange 本身被加入依賴項
        onConfigChangeRef.current({
            facebook_ad_account_id: formState.facebook_ad_account_id,
            insights_level: formState.insights_level,
            selected_fields: Array.from(formState.selected_fields),
            selected_breakdowns: Array.from(formState.selected_breakdowns),
            selected_action_breakdowns: Array.from(formState.selected_action_breakdowns),
        });
    }, [formState]); 

    const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormState(prev => ({
            ...prev,
            insights_level: e.target.value,
            selected_fields: new Set(),
            selected_breakdowns: new Set(),
            selected_action_breakdowns: new Set(),
        }));
    };

    const toggleSelection = (category: 'fields' | 'breakdowns' | 'action_breakdowns', fieldName: string) => {
        const key = `selected_${category}` as const;
        setFormState(prev => {
            const newSet = new Set(prev[key]);
            if (newSet.has(fieldName)) newSet.delete(fieldName);
            else newSet.add(fieldName);
            return { ...prev, [key]: newSet };
        });
    };
    
    const levelKey = formState.insights_level === 'adset' ? 'ad_set' : formState.insights_level;
    const availableFields = allFields ? allFields[levelKey] : null;

    return (
        <>
            <div className="mb-3">
                <label htmlFor="facebook_ad_account_id" className="form-label">Ad Account</label>
                <select id="facebook_ad_account_id" value={formState.facebook_ad_account_id}
                        onChange={e => setFormState(p => ({...p, facebook_ad_account_id: e.target.value}))} className="form-select">
                    <option value="">--- Select Ad Account ---</option>
                    {adAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.id})</option>)}
                </select>
            </div>
            <div className="mb-3">
                <label htmlFor="insights_level" className="form-label">Insights Level</label>
                <select id="insights_level" value={formState.insights_level} onChange={handleLevelChange} className="form-select">
                    <option value="campaign">Campaign</option>
                    <option value="adset">Ad Set</option>
                    <option value="ad">Ad</option>
                </select>
            </div>
            
            {availableFields && (
                (['fields', 'breakdowns', 'action_breakdowns'] as const).map(category => (
                    <div className="row mb-3" key={category}>
                        <div className="col-md-6">
                            <h6 className="text-capitalize">{category.replace('_', ' ')}</h6>
                            <div className="list-group" style={{maxHeight: '200px', overflowY: 'auto'}}>
                                {availableFields[category]?.map(field => (
                                    <button type="button" key={field.name} onClick={() => toggleSelection(category, field.name)}
                                            className={`list-group-item list-group-item-action ${formState[`selected_${category}`].has(field.name) ? 'active' : ''}`}>
                                        {field.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-md-6">
                            <h6 className="text-capitalize">Selected {category.replace('_', ' ')}</h6>
                            <div className="border rounded p-2" style={{minHeight: '200px', overflowY: 'auto'}}>
                                {Array.from(formState[`selected_${category}`]).map(fieldName => {
                                    const field = availableFields[category].find(f => f.name === fieldName);
                                    return (
                                        <span key={fieldName} className="badge bg-secondary me-1 mb-1">
                                            {field?.label || fieldName}
                                            <button type="button" className="btn-close btn-close-white ms-1" style={{fontSize: '0.6em'}} onClick={() => toggleSelection(category, fieldName)}></button>
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </>
    );
}