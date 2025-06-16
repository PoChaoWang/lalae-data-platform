// /components/connections/FacebookAdsFields.tsx
'use client';

// ✨ 步驟 1: 導入所有需要的 UI 元件和圖示
import { useState, useEffect, useRef } from 'react';
import type { SelectableClient } from '@/lib/definitions';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  X,
  Search,
  Zap,
  BarChart3,
  Target,
  Database,
  Loader2,
  Plus,
  Users,
  TrendingUp,
} from "lucide-react";


// --- 既有的 API 呼叫函式和型別定義維持不變 ---
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

type AdAccount = { id: string; name: string };
type FBField = { name: string; label: string };
type AllFBFields = { [level: string]: { fields: FBField[], breakdowns: FBField[], action_breakdowns: FBField[] } };

async function getAdAccounts(clientId: string): Promise<AdAccount[]> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/facebook-ad-accounts/?client_id=${clientId}`, { credentials: 'include' });
    if (!res.ok) return [];
    return res.json();
}

async function getAllFacebookFields(): Promise<AllFBFields> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/facebook-all-fields/`, { credentials: 'include' });
    if (!res.ok) {
        console.error(`Failed to fetch Facebook fields: ${res.status} ${res.statusText}`);
        return {};
    }
    return res.json();
}

// --- 主要元件開始 ---
export default function FacebookAdsFields({ onConfigChange, client, initialConfig }: { onConfigChange: (config: object) => void, client: SelectableClient, initialConfig?: any }) {
    // === 既有的 State 管理維持不變 ===
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [allFields, setAllFields] = useState<AllFBFields | null>(null);
    const [formState, setFormState] = useState(() => ({
        facebook_ad_account_id: initialConfig?.facebook_ad_account_id || '',
        insights_level: initialConfig?.insights_level || 'campaign',
        selected_fields: new Set<string>(initialConfig?.selected_fields || []),
        selected_breakdowns: new Set<string>(initialConfig?.selected_breakdowns || []),
        selected_action_breakdowns: new Set<string>(initialConfig?.action_breakdowns || initialConfig?.selected_action_breakdowns || []),
    }));

    // ✨ 新增 UI 狀態，用以控制新版 UI 的互動
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["fields"]));
    const [searchTerms, setSearchTerms] = useState<Record<string, string>>({
      fields: "",
      breakdowns: "",
      action_breakdowns: "",
    });

    // === 既有的 useEffect Hooks (功能邏輯) 維持不變 ===
    const onConfigChangeRef = useRef(onConfigChange);
    useEffect(() => {
        onConfigChangeRef.current = onConfigChange;
    }, [onConfigChange]);

    useEffect(() => {
        getAdAccounts(String(client.id)).then(setAdAccounts);
        getAllFacebookFields().then(setAllFields);
    }, [client.id]);

    useEffect(() => {
        if (initialConfig && adAccounts.length > 0) {
            setFormState({
                facebook_ad_account_id: initialConfig.facebook_ad_account_id || '',
                insights_level: initialConfig.insights_level || 'campaign',
                selected_fields: new Set<string>(initialConfig.selected_fields || []),
                selected_breakdowns: new Set<string>(initialConfig.selected_breakdowns || []),
                selected_action_breakdowns: new Set<string>(initialConfig.action_breakdowns || initialConfig.selected_action_breakdowns || []),
            });
        }
    }, [JSON.stringify(initialConfig), adAccounts]);

    useEffect(() => {
        onConfigChangeRef.current({
            facebook_ad_account_id: formState.facebook_ad_account_id,
            insights_level: formState.insights_level,
            selected_fields: Array.from(formState.selected_fields),
            selected_breakdowns: Array.from(formState.selected_breakdowns),
            selected_action_breakdowns: Array.from(formState.selected_action_breakdowns),
        });
    }, [formState]); 

    // === 既有的事件處理函式，部分微調以適應新 UI 元件 ===
    const handleLevelChange = (value: string) => {
        setFormState(prev => ({
            ...prev,
            insights_level: value,
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
    
    // ✨ 新增 UI 輔助函式
    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) newSet.delete(category);
            else newSet.add(category);
            return newSet;
        });
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case "fields": return BarChart3;
            case "breakdowns": return Target;
            case "action_breakdowns": return TrendingUp;
            default: return Database;
        }
    };
    
    const getCategoryDisplayName = (category: string) => {
        return category.replace('_', ' ');
    };

    const getFilteredFields = (fields: FBField[], category: string) => {
        const searchTerm = searchTerms[category] || "";
        if (!searchTerm) return fields;
        return fields.filter(
            (field) =>
            field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const levelKey = formState.insights_level === 'adset' ? 'ad_set' : formState.insights_level;
    const availableFields = allFields ? allFields[levelKey] : null;
    const totalSelected = formState.selected_fields.size + formState.selected_breakdowns.size + formState.selected_action_breakdowns.size;

    // ✨ 步驟 2: 使用新的 JSX 結構和樣式，但綁定到既有的狀態和函式
    return (
        <div className="space-y-8">
            {/* --- Configuration Section --- */}
            <div className="space-y-6">
                <h3 className="text-xl font-semibold text-orange-400 mb-6 flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Facebook Ads Configuration</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <Label className="text-white font-medium">Facebook Ad Account</Label>
                        <Select
                            value={formState.facebook_ad_account_id}
                            onValueChange={(value:string) => setFormState((prev) => ({ ...prev, facebook_ad_account_id: value }))}
                        >
                            <SelectTrigger className="mt-2 bg-gray-900/50 border-gray-600/50 text-white">
                                <SelectValue placeholder={adAccounts.length === 0 ? "Loading..." : "Select Ad Account"} />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                                {adAccounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                        {account.name} ({account.id})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-white font-medium">Insights Level</Label>
                        <Select value={formState.insights_level} onValueChange={handleLevelChange}>
                            <SelectTrigger className="mt-2 bg-gray-900/50 border-gray-600/50 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                                <SelectItem value="campaign">Campaign</SelectItem>
                                <SelectItem value="adset">Ad Set</SelectItem>
                                <SelectItem value="ad">Ad</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* --- Fields Selection Section --- */}
            {availableFields && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Available Fields */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-orange-400 flex items-center space-x-2">
                            <Database className="w-5 h-5" />
                            <span>Available Selections</span>
                        </h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                            {(["fields", "breakdowns", "action_breakdowns"] as const).map((category) => {
                                const fields = availableFields[category] || [];
                                const filteredFields = getFilteredFields(fields, category);
                                const CategoryIcon = getCategoryIcon(category);
                                return (
                                    <Collapsible key={category} open={expandedCategories.has(category)} onOpenChange={() => toggleCategory(category)}>
                                        <CollapsibleTrigger className="w-full flex items-center p-3 hover:bg-gray-700/30 rounded-md border border-gray-700/50">
                                            {expandedCategories.has(category) ? <ChevronDown className="w-4 h-4 mr-2"/> : <ChevronRight className="w-4 h-4 mr-2" />}
                                            <CategoryIcon className="w-4 h-4 mr-2" />
                                            <span className="font-medium text-white capitalize">{getCategoryDisplayName(category)}</span>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="border border-t-0 border-gray-700/50 rounded-b-md p-2">
                                            <div className="relative mb-2">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <Input
                                                    placeholder={`Search ${getCategoryDisplayName(category)}...`}
                                                    value={searchTerms[category] || ""}
                                                    onChange={(e) => setSearchTerms(prev => ({...prev, [category]: e.target.value}))}
                                                    className="pl-10 h-8 bg-gray-800/50 border-gray-600/50"
                                                />
                                            </div>
                                            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                                {filteredFields.map((field) => (
                                                    <button key={field.name} onClick={() => toggleSelection(category, field.name)}
                                                        className={`w-full text-left p-2 rounded-md hover:bg-gray-700/30 flex items-center justify-between group ${formState[`selected_${category}`].has(field.name) ? "bg-orange-500/10 text-orange-300" : "text-gray-300"}`} type="button">
                                                        <span>{field.label}</span>
                                                        {formState[`selected_${category}`].has(field.name) ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                )
                            })}
                        </div>
                        
                    </div>

                    {/* Selected Fields */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-orange-400 flex items-center space-x-2">
                            <Target className="w-5 h-5" />
                            <span>Selected Summary ({totalSelected})</span>
                        </h3>
                        <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4 min-h-48 max-h-[30rem] overflow-y-auto space-y-4">
                            {(["fields", "breakdowns", "action_breakdowns"] as const).map(category => {
                                const selectedSet = formState[`selected_${category}`];
                                if (selectedSet.size === 0) return null;
                                return (
                                    <div key={category}>
                                        <h4 className="text-white font-medium capitalize text-sm mb-2">{getCategoryDisplayName(category)}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {Array.from(selectedSet).map(fieldName => {
                                                const field = (availableFields[category] || []).find(f => f.name === fieldName);
                                                return (
                                                    <Badge key={fieldName} variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                                                        {field?.label || fieldName}
                                                        <button onClick={() => toggleSelection(category, fieldName)} className="ml-2" type="button">
                                                            <X className="w-3 h-3"/>
                                                        </button>
                                                    </Badge>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                            {totalSelected === 0 && <p className="text-gray-500 text-center py-4">No selections made.</p>}
                        </div>
                        {totalSelected > 0 && (
                            <div className="flex justify-end">
                                <Button onClick={() => setFormState(prev => ({...prev, selected_fields: new Set(), selected_breakdowns: new Set(), selected_action_breakdowns: new Set()}))} variant="destructive" size="sm" type="button">
                                    Clear All Selections
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}