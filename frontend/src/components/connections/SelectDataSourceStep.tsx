// /components/connections/SelectDataSourceStep.tsx
'use client';

import { useState, useEffect } from 'react';
import type { DataSource } from '@/lib/definitions';
import ProtectedComponent from '@/components/ProtectedComponent';
import { Check, AlertTriangle } from 'lucide-react';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

async function getDataSources(): Promise<DataSource[]> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/datasources/`, {
        cache: 'no-store',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch data sources');
    return res.json();
}

const getSourceStyle = (sourceName: string) => {
    if (sourceName.includes('GOOGLE_ADS')) return { logo: 'G', color: 'blue' };
    if (sourceName.includes('FACEBOOK_ADS')) return { logo: 'F', color: 'blue' };
    if (sourceName.includes('GOOGLE_SHEET')) return { logo: 'S', color: 'green' };
    return { logo: sourceName.charAt(0), color: 'gray' };
}

export default function SelectDataSourceStep({
    onDataSourceSelect,
    selectedDataSource
}: {
    onDataSourceSelect: (dataSource: DataSource) => void;
    selectedDataSource: DataSource | null;
}) {
    const [dataSources, setDataSources] = useState<DataSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getDataSources()
            .then(setDataSources)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // --- UI from Wizard with Loading/Error States ---
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 animate-pulse">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-700"></div>
                        <div className="h-5 w-3/4 mx-auto bg-gray-700 rounded-md"></div>
                    </div>
                ))}
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-6 flex items-center space-x-4">
                <AlertTriangle className="w-10 h-10 text-red-400" />
                <div>
                    <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
                    <p className="text-red-400 mt-1">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <ProtectedComponent>
            <div>
                {/* The h2 title is now managed by page.tsx */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {dataSources.map((source) => {
                        const { logo, color } = getSourceStyle(source.name);
                        return (
                            <div
                                key={source.id}
                                onClick={() => onDataSourceSelect(source)}
                                className={`p-6 rounded-xl border cursor-pointer transition-all duration-300 hover:scale-105 ${
                                    selectedDataSource?.id === source.id
                                        ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/25"
                                        : "border-gray-700 hover:border-orange-500/50 bg-gray-900/30"
                                }`}
                            >
                                <div className="text-center">
                                    <div
                                        className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center text-2xl font-bold ${
                                            color === "blue" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                                        }`}
                                    >
                                        {logo}
                                    </div>
                                    <h3 className="text-white font-semibold">{source.display_name}</h3>
                                    {selectedDataSource?.id === source.id && (
                                        <Check className="w-5 h-5 text-orange-400 mx-auto mt-2" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ProtectedComponent>
    );
}