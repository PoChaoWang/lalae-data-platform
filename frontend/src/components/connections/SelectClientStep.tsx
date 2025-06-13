// /components/connections/SelectClientStep.tsx
'use client';

import { useState, useEffect } from 'react';
import type { SelectableClient } from '@/lib/definitions'; // ✨ 修正：從 definitions 匯入
import ProtectedComponent from '@/components/ProtectedComponent'; 
// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

async function getClients(): Promise<SelectableClient[]> {
    // ✨ 修正：使用正確的完整路徑
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/clients/`, {
        cache: 'no-store',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch clients');
    return res.json();
  }
  // ... (元件其餘部分不變)
  export default function SelectClientStep({ onClientSelect }: { onClientSelect: (client: SelectableClient) => void }) {
    const [clients, setClients] = useState<SelectableClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      getClients()
        .then(setClients)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }, []);
  
    if (loading) return <div>Loading clients...</div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
  
    return (
        <ProtectedComponent>
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                {clients.map(client => (
                <div className="col" key={client.id}>
                    <div className="card h-100" onClick={() => onClientSelect(client)} style={{ cursor: 'pointer' }}>
                    <div className="card-body">
                        <h5 className="card-title text-dark">{client.name}</h5>
                        <p className="card-text text-muted">Dataset ID: {client.bigquery_dataset_id}</p>
                    </div>
                    </div>
                </div>
                ))}
            </div>
        </ProtectedComponent>
        
    );
  }