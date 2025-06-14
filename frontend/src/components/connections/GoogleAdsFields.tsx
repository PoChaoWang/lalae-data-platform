// /components/connections/GoogleAdsFields.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import type { SelectableClient } from '@/lib/definitions';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

type Field = { name: string; display: string };
type AvailableFields = { metrics: Field[]; segments: Field[]; attributes: Field[] };

async function fetchResources(): Promise<Field[]> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/google-ads-resources/`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch resources');
    return res.json();
}

async function fetchCompatibleFields(resourceName: string): Promise<AvailableFields> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/get-compatible-google-ads-fields/?resource=${resourceName}`, {
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch compatible fields');
    return res.json();
}

export default function GoogleAdsFields({ onConfigChange, client, initialConfig }: { onConfigChange: (config: object) => void, client: SelectableClient, initialConfig: any }) {
    // === State Declarations ===
    const [customerId, setCustomerId] = useState('');
    const [resources, setResources] = useState<Field[]>([]);
    const [selectedResource, setSelectedResource] = useState('');
    
    const [availableFields, setAvailableFields] = useState<AvailableFields | null>(null);
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
    const [loadingFields, setLoadingFields] = useState(false);
    
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const prevResourceRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        fetchResources().then(setResources).catch(error => {
            console.error("Error fetching resources list:", error);
            // 可以在此設定錯誤狀態，通知使用者列表載入失敗
        });
    }, []);

    useEffect(() => {
        if (initialConfig) {
            setCustomerId(initialConfig.customer_id || '');
            setSelectedResource(initialConfig.resource_name || '');
            const allFields = new Set<string>([
                ...(initialConfig.metrics || []),
                ...(initialConfig.segments || []),
                ...(initialConfig.attributes || [])
            ]);
            setSelectedFields(allFields);

            if (resources.length > 0) {
                setSelectedResource(initialConfig.resource_name || '');
            }
        }
    }, [JSON.stringify(initialConfig), resources]);

    useEffect(() => {
        const isManualChange = prevResourceRef.current !== undefined && prevResourceRef.current !== selectedResource;

        // 更新 ref 以供下次比較
        prevResourceRef.current = selectedResource;

        if (!selectedResource) {
            setAvailableFields(null);
            return;
        }

        setLoadingFields(true);
        fetchCompatibleFields(selectedResource)
            .then(data => {
                setAvailableFields(data);
                // 只有在手動切換時，才清空不相容的欄位
                if (isManualChange) {
                    setSelectedFields(prevSelected => {
                        const newSelected = new Set<string>();
                        const allAvailableFieldNames = new Set([...data.metrics.map(f => f.name), ...data.segments.map(f => f.name), ...data.attributes.map(f => f.name)]);
                        prevSelected.forEach(field => {
                            if (allAvailableFieldNames.has(field)) newSelected.add(field);
                        });
                        return newSelected;
                    });
                }
            })
            .catch(console.error)
            .finally(() => setLoadingFields(false));
    }, [selectedResource]);

    // Hook 4: 將使用者變更的最終 config 通知父元件
    useEffect(() => {
        const metrics: string[] = [];
        const segments: string[] = [];
        const attributes: string[] = [];

        if (availableFields) {
            selectedFields.forEach(fieldName => {
                if (availableFields.metrics.some(f => f.name === fieldName)) metrics.push(fieldName);
                else if (availableFields.segments.some(f => f.name === fieldName)) segments.push(fieldName);
                else if (availableFields.attributes.some(f => f.name === fieldName)) attributes.push(fieldName);
            });
        }
        
        onConfigChange({
            customer_id: customerId,
            resource_name: selectedResource,
            metrics,
            segments,
            attributes,
        });
    }, [customerId, selectedResource, selectedFields, onConfigChange]);
    
    const toggleFieldSelection = (fieldName: string) => {
        setSelectedFields(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fieldName)) newSet.delete(fieldName);
            else newSet.add(fieldName);
            return newSet;
        });
    };

    // ✨ 用來切換 Accordion 狀態的函式
    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) newSet.delete(category);
            else newSet.add(category);
            return newSet;
        });
    };

    return (
        <>
            {/* ... Customer ID 和 Resource select 不變 ... */}
            <div className="mb-3">
                <label htmlFor="customer_id" className="form-label">Google Ads Customer ID</label>
                <input 
                    id="customer_id" 
                    value={customerId} 
                    onChange={e => setCustomerId(e.target.value.replace(/-/g, ''))} 
                    className="form-control" 
                />
            </div>
            <div className="mb-3">
                <label htmlFor="resource_name" className="form-label">Report Level (Resource)</label>
                <select 
                    id="resource_name" 
                    value={selectedResource} 
                    onChange={e => setSelectedResource(e.target.value)} 
                    className="form-select"
                >
                    <option value="">--- Select a Resource ---</option>
                    {resources.map(r => <option key={r.name} value={r.name}>{r.display}</option>)}
                </select>
            </div>
    
            {selectedResource && (
                <div className="row">
                    <div className="col-md-6">
                        <h6>Available Fields</h6>
                        {loadingFields ? <div className="spinner-border spinner-border-sm" /> : (
                            <div className="accordion" id="fields-accordion">
                                {availableFields && Object.entries(availableFields).map(([category, fields]) => (
                                    fields.length > 0 && (
                                        <div className="accordion-item" key={category}>
                                            <h2 className="accordion-header">
                                                <button 
                                                    className={`accordion-button ${expandedCategories.has(category) ? '' : 'collapsed'}`}
                                                    type="button" 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        toggleCategory(category);
                                                    }}
                                                >
                                                    {category.charAt(0).toUpperCase() + category.slice(1)} ({fields.length})
                                                </button>
                                            </h2>
                                            <div 
                                                id={`collapse-${category}`} 
                                                className={`accordion-collapse collapse list-group list-group-flush ${expandedCategories.has(category) ? 'show' : ''}`}
                                                style={{maxHeight: '250px', overflowY: 'auto'}}
                                            >
                                                {fields.map(field => (
                                                    <button
                                                        key={field.name}
                                                        type="button"
                                                        onClick={(e) => { 
                                                            e.preventDefault(); 
                                                            toggleFieldSelection(field.name); 
                                                        }}
                                                        className={`list-group-item list-group-item-action ${selectedFields.has(field.name) ? 'active' : ''}`}
                                                    >
                                                        {field.display}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="col-md-6">
                         <h6>Selected Fields ({selectedFields.size})</h6>
                         <div className="border rounded p-2" style={{minHeight: '150px', maxHeight: '300px', overflowY: 'auto'}}>
                            {Array.from(selectedFields).map(fieldName => (
                                <span key={fieldName} className="badge bg-primary me-1 mb-1">
                                    {
                                        // 尋找對應的 display 名稱
                                        Object.values(availableFields || {}).flat().find(f => f.name === fieldName)?.display || fieldName
                                    }
                                    <button 
                                        type="button" 
                                        className="btn-close btn-close-white ms-1" 
                                        style={{fontSize: '0.6em'}} 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            toggleFieldSelection(fieldName);
                                        }}
                                    ></button>
                                </span>
                            ))}
                         </div>
                    </div>
                </div>
            )}
        </>
    );
}