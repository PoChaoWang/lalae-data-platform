'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

export default function CloneConnectionButton({ connectionId }: { connectionId: number }) {
  const router = useRouter();
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    setIsCloning(true);
    try {
        const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/clone/`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to clone');
        const newConnection = await res.json();
        // 成功複製後，跳轉到新的連線編輯頁或詳情頁
        router.push(`/connections/${newConnection.id}`);
    } catch (error) {
        console.error(error);
        alert('Failed to clone connection.');
    } finally {
        setIsCloning(false);
    }
  };

  return (
    <button onClick={handleClone} disabled={isCloning} className="btn btn-secondary">
      {isCloning ? 'Cloning...' : 'Clone Connection'}
    </button>
  );
}
