// frontend/src/app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // 從 localStorage 中讀取我們之前儲存的路徑
    const returnPath = localStorage.getItem('oauth_redirect_path');
    
    // 使用完畢後，立即從 localStorage 中移除，保持乾淨
    localStorage.removeItem('oauth_redirect_path');

    // 使用 Next.js router 將使用者導向到目標頁面
    // 如果找不到儲存的路徑，就導向到首頁作為備案
    router.replace(returnPath || '/');
    
  }, [router]);

  // 這個頁面不需要複雜的 UI，只顯示一個載入提示
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Authentication successful, redirecting...</p>
    </div>
  );
}