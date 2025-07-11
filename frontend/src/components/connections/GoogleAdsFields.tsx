// /components/connections/GoogleAdsFields.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import type { SelectableClient } from '@/lib/definitions';
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';

// UI 元件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
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
    Plus } from "lucide-react";

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

type Field = { name: string; display: string };
type AvailableFields = { metrics: Field[]; segments: Field[]; attributes: Field[] };

async function fetchResources(protectedFetch: Function): Promise<Field[]> {
    const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/google-ads-resources/`);
    if (!res.ok) throw new Error('Failed to fetch resources');
    return res.json();
}

async function fetchCompatibleFields(protectedFetch: Function, resourceName: string): Promise<AvailableFields> {
    const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/get-compatible-google-ads-fields/?resource=${resourceName}`);
    if (!res.ok) throw new Error('Failed to fetch compatible fields');
    return res.json();
}

export default function GoogleAdsFields({ onConfigChange, client, initialConfig }: { onConfigChange: (config: object) => void, client: SelectableClient, initialConfig: any }) {
    const { protectedFetch } = useProtectedFetch();
    const [customerId, setCustomerId] = useState('');
    const [resources, setResources] = useState<Field[]>([]);
    const [selectedResource, setSelectedResource] = useState('');
    const [availableFields, setAvailableFields] = useState<AvailableFields | null>(null);
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
    const [loadingFields, setLoadingFields] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["metrics"]));
    const prevResourceRef = useRef<string | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!protectedFetch) return;
        fetchResources(protectedFetch).then(setResources).catch(error => {
            console.error("Error fetching resources list:", error);
        });
    }, [protectedFetch]);

    useEffect(() => {
        if (initialConfig) {
            setCustomerId(initialConfig.customer_id || '');
            const allFields = new Set<string>([...(initialConfig.metrics || []), ...(initialConfig.segments || []), ...(initialConfig.attributes || [])]);
            setSelectedFields(allFields);
            if (resources.length > 0) {
                setSelectedResource(initialConfig.resource_name || '');
            }
        }
    }, [initialConfig, resources]);

    useEffect(() => {
        const isManualChange = prevResourceRef.current !== undefined && prevResourceRef.current !== selectedResource;
        prevResourceRef.current = selectedResource;

        if (!selectedResource || !protectedFetch) {
            setAvailableFields(null);
            return;
        }

        setLoadingFields(true);
        fetchCompatibleFields(protectedFetch, selectedResource)
            .then(data => {
                setAvailableFields(data);
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
    }, [selectedResource, protectedFetch]);

    // useEffect(() => {
    //     const metrics: string[] = [];
    //     const segments: string[] = [];
    //     const attributes: string[] = [];
    //     if (availableFields) {
    //         selectedFields.forEach(fieldName => {
    //             if (availableFields.metrics.some(f => f.name === fieldName)) metrics.push(fieldName);
    //             else if (availableFields.segments.some(f => f.name === fieldName)) segments.push(fieldName);
    //             else if (availableFields.attributes.some(f => f.name === fieldName)) attributes.push(fieldName);
    //         });
    //     }
    //     onConfigChange({
    //         customer_id: customerId,
    //         resource_name: selectedResource,
    //         metrics,
    //         segments,
    //         attributes,
    //     });
    // }, [customerId, selectedResource, selectedFields, onConfigChange, availableFields]);

    const toggleFieldSelection = (fieldName: string) => {
        // 更新 selectedFields 的 state
        const newSelected = new Set(selectedFields);
        if (newSelected.has(fieldName)) {
            newSelected.delete(fieldName);
        } else {
            newSelected.add(fieldName);
        }
        setSelectedFields(newSelected);
    
        const metrics: string[] = [];
        const segments: string[] = [];
        const attributes: string[] = [];
        if (availableFields) {
            newSelected.forEach(name => {
                if (availableFields.metrics.some(f => f.name === name)) metrics.push(name);
                else if (availableFields.segments.some(f => f.name === name)) segments.push(name);
                else if (availableFields.attributes.some(f => f.name === name)) attributes.push(name);
            });
        }
        onConfigChange({
            customer_id: customerId,
            resource_name: selectedResource,
            metrics,
            segments,
            attributes,
        });
    };

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
            case "metrics": return BarChart3;
            case "segments": return Target;
            case "attributes": return Database;
            default: return Database;
        }
    };

    const getFilteredFields = (fields: Field[]) => {
        if (!searchTerm) return fields;
        return fields.filter(
            (field) =>
            field.display.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };
    // ✨ 步驟 2: 使用新的 JSX 結構和樣式，但綁定到既有的狀態和函式
    return (
        <div className="space-y-8">
            {/* --- Configuration Section --- */}
            <div className="space-y-6">
                <h3 className="text-xl font-semibold text-orange-400 mb-6 flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Google Ads Configuration</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <Label className="text-white font-medium">Google Ads Customer ID</Label>
                        <Input
                            value={customerId}
                            onChange={(e) => {
                                const newCustomerId = e.target.value.replace(/-/g, "");
                                setCustomerId(newCustomerId);
                                onConfigChange({ ...initialConfig, customer_id: newCustomerId });
                            }}
                            placeholder="1234567890"
                            className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
                        />
                    </div>
                    <div>
                        <Label className="text-white font-medium">Report Level (Resource)</Label>
                        <Select 
                            value={selectedResource} 
                            onValueChange={(value: string) => {
                                setSelectedResource(value);
                                onConfigChange({ 
                                    ...initialConfig, 
                                    resource_name: value,
                                    // 當 resource 改變時，通常需要清空舊的 fields
                                    metrics: [],
                                    segments: [],
                                    attributes: [],
                                });
                            }}
                        >
                            <SelectTrigger className="mt-2 bg-gray-900/50 border-gray-600/50 text-white">
                                <SelectValue placeholder={resources.length === 0 ? "Loading..." : "Select a Resource"} />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                                {resources.map((resource) => (
                                    <SelectItem key={resource.name} value={resource.name}>
                                        {resource.display}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* --- Fields Selection Section --- */}
            {selectedResource && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Available Fields */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-orange-400 flex items-center space-x-2">
                                <Database className="w-5 h-5" />
                                <span>Available Fields</span>
                            </h3>
                            {loadingFields && <Loader2 className="w-5 h-5 animate-spin text-orange-400" />}
                        </div>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Search fields..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-gray-900/50 border-gray-600/50"
                            />
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-700/50 rounded-lg p-2 custom-scrollbar">
                            {availableFields && Object.entries(availableFields).map(([category, fields]) => {
                                const filteredFields = getFilteredFields(fields);
                                if (filteredFields.length === 0) return null;
                                const CategoryIcon = getCategoryIcon(category);
                                const isExpanded = expandedCategories.has(category);
                                return (
                                    <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                                        <CollapsibleTrigger className="w-full flex items-center p-2 hover:bg-gray-700/30 rounded-md">
                                            {isExpanded ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                                            <CategoryIcon className="w-4 h-4 mr-2" />
                                            <span className="font-medium text-white capitalize">{category}</span>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="pl-4 py-2 space-y-1">
                                                {filteredFields.map((field) => (
                                                    <button
                                                        key={field.name}
                                                        type="button"
                                                        onClick={() => toggleFieldSelection(field.name)}
                                                        className={`w-full text-left p-2 rounded-md hover:bg-gray-700/30 flex items-center justify-between group ${selectedFields.has(field.name) ? "bg-orange-500/10 text-orange-300" : "text-gray-300"}`}
                                                    >
                                                        <span>{field.display}</span>
                                                        {selectedFields.has(field.name) 
                                                            ? <X className="w-4 h-4" /> 
                                                            : <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                                                        }
                                                    </button>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected Fields */}
                    <div>
                        <h3 className="text-xl font-semibold text-orange-400 mb-4 flex items-center space-x-2">
                            <Target className="w-5 h-5" />
                            <span>Selected Fields ({selectedFields.size})</span>
                        </h3>
                        <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4 min-h-48 max-h-96 overflow-y-auto custom-scrollbar">
                            {selectedFields.size === 0 ? (
                                <p className="text-gray-500 text-center py-4">No fields selected.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {Array.from(selectedFields).map((fieldName) => {
                                        const field = Object.values(availableFields || {}).flat().find((f) => f.name === fieldName);
                                        return (
                                            <Badge
                                                key={fieldName}
                                                variant="secondary"
                                                className="bg-orange-500/20 text-orange-300 border-orange-500/30"
                                            >
                                                {field?.display || fieldName}
                                                <button onClick={() => toggleFieldSelection(fieldName)} className="ml-2">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                         {selectedFields.size > 0 && (
                            <div className="mt-4 flex justify-end">
                                <Button onClick={() => setSelectedFields(new Set())} variant="destructive" size="sm" type="button">
                                    Clear All
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}