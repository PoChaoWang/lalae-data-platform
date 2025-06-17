// components/ProtectedComponent.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from './ui/LoadingSpinner';

export default function ProtectedComponent({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // 使用 useSession，並加入驗證選項
  const { status } = useSession({
    required: true, 
    onUnauthenticated() {
      router.push('/login'); 
    },
  });

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner />
        <p className="mt-6 text-lg tracking-wider px-1 text-orange-400">
          Loading authentication status...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}