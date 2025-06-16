// components/ProtectedComponent.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation'; // ✨ 使用 next/navigation
import { useEffect } from 'react';
import LoadingSpinner from './ui/LoadingSpinner';

export default function ProtectedComponent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    
    if (!loading && !user?.isAuthenticated) {
      // router.push('http://localhost:8000/users/login/');
      router.push('https://98dd-114-24-81-73.ngrok-free.app/users/login/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner />
        <p className="mt-6 text-lg tracking-wider px-1 text-orange-400">
          Loading authentication status...
        </p>
      </div>
    );
  }

  
  if (user?.isAuthenticated) {
    return <>{children}</>;
  }

  return null;
}