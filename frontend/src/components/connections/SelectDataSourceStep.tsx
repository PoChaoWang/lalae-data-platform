// /components/connections/SelectDataSourceStep.tsx
'use client';

import { useState, useEffect } from 'react';
import type { DataSource } from '@/lib/definitions'; // ✨ 修正：從 definitions 匯入
import ProtectedComponent from '@/components/ProtectedComponent'; 
// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

async function getDataSources(): Promise<DataSource[]> {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/datasources/`, {
        cache: 'no-store',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch data sources');
        return res.json();
    }

export default function SelectDataSourceStep({ onDataSourceSelect }: { onDataSourceSelect: (dataSource: DataSource) => void }) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataSources()
      .then(setDataSources)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading data sources...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <ProtectedComponent>

        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
        {dataSources.map(source => (
            <div className="col" key={source.id}>
            <div className="card h-100">
                <div className="card-body">
                <h5 className="card-title">{source.display_name}</h5>
                <p className="card-text">Connect to {source.display_name} API.</p>
                </div>
                <div className="card-footer">
                <button onClick={() => onDataSourceSelect(source)} className="btn btn-primary w-100">Connect to {source.display_name}</button>
                </div>
            </div>
            </div>
        ))}
        </div>

    </ProtectedComponent>
  );
}
