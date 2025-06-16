// /components/connections/SelectDataSourceStep.tsx
'use client';

import { useState, useEffect } from 'react';
import type { DataSource } from '@/lib/definitions';
import ProtectedComponent from '@/components/ProtectedComponent';
import { Check, AlertTriangle } from 'lucide-react';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-8 h-8">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.545,44,30.228,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
    </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className}>
        <g transform="translate(180, 128) scale(0.5)">
            <path fill="currentColor" d="M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z"/>
        </g>
    </svg>
);

const GoogleSheetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-8 h-8">
        <path fill="#43a047" d="M37,45H11c-1.657,0-3-1.343-3-3V6c0-1.657,1.343-3,3-3h19l10,10v29C40,43.657,38.657,45,37,45z" />
        <path fill="#c8e6c9" d="M30 3 L30 13 L40 13 Z" />
        <path fill="#a5d6a7" d="M30,13h10L30,3V13z" />
        <path fill="#fff" d="M14,24h8v2h-8V24z M14,28h13v2H14V28z M14,32h13v2H14V32z M14,36h13v2H14V36z" />
        <path fill="#fff" d="M25.5,21h-2V18h-2v3h-2v2h2v3h2v-3h2V21z" />
    </svg>
);

async function getDataSources(): Promise<DataSource[]> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/datasources/`, {
        cache: 'no-store',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch data sources');
    return res.json();
}

const getSourceStyle = (sourceName: string) => {
    if (sourceName.includes('GOOGLE_ADS')) return { logo: GoogleIcon, color: 'blue' };
    if (sourceName.includes('FACEBOOK_ADS')) return { logo: FacebookIcon, color: 'blue' };
    if (sourceName.includes('GOOGLE_SHEET')) return { logo: GoogleSheetIcon, color: 'green' };
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
                        const { logo: Logo, color } = getSourceStyle(source.name);
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
                                        <Logo />
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