'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Connection } from '@/lib/definitions';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

// export default function CloneConnectionButton({ connection }: { connection: Connection; }) {
  
export default function CloneConnectionButton({ connectionId }: { connectionId: number; }) {
  const router = useRouter();

  const handleClone = () => {
    const params = new URLSearchParams();
    params.set('cloneFrom', connectionId.toString());
    router.push(`/connections/new?${params.toString()}`);
  };

  return (
    <button onClick={handleClone} className="btn btn-secondary">
      <i className="bi bi-copy"></i> Clone to New Connection
    </button>
  );
}
