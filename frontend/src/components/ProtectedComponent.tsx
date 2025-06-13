// components/ProtectedComponent.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation'; // ✨ 使用 next/navigation
import { useEffect } from 'react';

export default function ProtectedComponent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 當驗證狀態結束載入，且使用者未登入時，將他們導向登入頁面
    if (!loading && !user?.isAuthenticated) {
      // router.push('http://localhost:8000/users/login/');
      router.push('https://98dd-114-24-81-73.ngrok-free.app/users/login/');
    }
  }, [user, loading, router]);

  // 狀態一：正在從後端讀取驗證狀態
  if (loading) {
    return <p>Loading authentication status...</p>; // 或顯示一個載入動畫
  }

  // 狀態二：使用者已登入，顯示子元件內容
  if (user?.isAuthenticated) {
    return <>{children}</>;
  }

  // 狀態三：使用者未登入（在重導向發生前可能會短暫顯示）
  // 也可以返回 null 或一個更友好的提示訊息
  return null;
}