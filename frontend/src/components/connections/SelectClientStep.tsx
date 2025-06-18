// /components/connections/SelectClientStep.tsx
'use client';

import { useState, useEffect } from 'react';
import type { SelectableClient } from '@/lib/definitions';
import ProtectedComponent from '@/components/ProtectedComponent';
import { AlertTriangle, Search, Check } from 'lucide-react';
import { Input } from "@/components/ui/input"; // Make sure you have this ShadCN component
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

// async function getClients(): Promise<SelectableClient[]> {
//     const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/clients/`, {
//         cache: 'no-store',
//         credentials: 'include'
//     });
//     if (!res.ok) throw new Error('Failed to fetch clients');
//     return res.json();
// }

export default function SelectClientStep({
    onClientSelect,
    selectedClient
}: {
    onClientSelect: (client: SelectableClient) => void;
    selectedClient: SelectableClient | null;
}) {
    const { protectedFetch } = useProtectedFetch();

    const [clients, setClients] = useState<SelectableClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    

    useEffect(() => {
        // 4. 將 fetch 邏輯放在 useEffect 內部
        const fetchClients = async () => {
            // 防衛敘述：確保 protectedFetch 已經準備好
            if (!protectedFetch) return;

            try {
                const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/clients/`);
                
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ message: 'Failed to fetch clients' }));
                    throw new Error(errorData.detail || errorData.message);
                }
                const data = await res.json();
                setClients(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, [protectedFetch]);

    const filteredClients = clients.filter((client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- UI from Wizard with Loading/Error States ---
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 animate-pulse">
                        <div className="h-5 w-3/4 bg-gray-700 rounded-md mb-3"></div>
                        <div className="h-4 w-1/2 bg-gray-700 rounded-md"></div>
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
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-gray-900/50 border-gray-600/50 text-white"
                        />
                    </div>
                </div>

                {/* --- ✨ Client selection now uses a grid layout --- */}
                <div className="flex flex-col space-y-2 max-h-96 overflow-y-auto pr-2">
                    {filteredClients.map((client) => (
                        <div
                            key={client.id}
                            onClick={() => onClientSelect(client)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 ${
                                selectedClient?.id === client.id
                                    ? "border-orange-500 bg-orange-500/10"
                                    : "border-gray-700 hover:border-orange-500/50 bg-gray-900/30"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-medium">{client.name}</h3>
                                    <code className="text-orange-300 text-sm font-mono">{client.bigquery_dataset_id}</code>
                                </div>
                                {selectedClient?.id === client.id && <Check className="w-5 h-5 text-orange-400" />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ProtectedComponent>
    );
}