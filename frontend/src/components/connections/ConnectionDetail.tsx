// /components/connections/ConnectionDetail.tsx
'use client';
import { useState, useEffect } from 'react';
import DeleteConnectionModal from './DeleteConnectionModal';
import CloneConnectionButton from './CloneConnectionButton';
import type { Connection } from '@/lib/definitions'; 

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

export default function ConnectionDetail({ initialConnection }: { initialConnection: Connection }) {
  const [connection, setConnection] = useState(initialConnection);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

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

  return (
    <div className="container my-4">
      <div className="card">
          <div className="card-header">Details</div>
          <div className="card-body">
            <h1>{connection.display_name}</h1>
            <p>Status: {connection.status}</p>
            <h6>Config:</h6>
            <pre className="bg-light p-2 border rounded">{JSON.stringify(connection.config, null, 2)}</pre>
          </div>
      </div>
      
      <div className="d-flex justify-content-end gap-2 mt-4">
        <CloneConnectionButton connectionId={connection.id} />
        <button onClick={() => setDeleteModalOpen(true)} className="btn btn-danger">Delete Connection</button>
      </div>

      <DeleteConnectionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        connectionId={connection.id}
        connectionName={connection.display_name}
        csrfToken={csrfToken}
      />
    </div>
  );
}