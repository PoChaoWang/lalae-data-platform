// contexts/ProtectedFetchContext.tsx
'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

// 定義我們提供的 fetch 函式的型別
type ProtectedFetch = (url: string, options?: RequestInit) => Promise<Response>;

// 建立 Context
const ProtectedFetchContext = createContext<{ protectedFetch: ProtectedFetch | null }>({
  protectedFetch: null,
});

// 建立 Provider 元件，這就是你說的「可以通行的環境」
export function ProtectedFetchProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // 使用 useCallback 來建立一個穩定的函式
  // 只有當 session?.accessToken 改變時，這個函式才會被重新建立
  const protectedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (status !== 'authenticated' || !session?.accessToken) {
        // 如果沒有有效的 session，直接拋出錯誤，讓呼叫它的地方去處理
        throw new Error('User is not authenticated.');
      }

      // 準備預設的標頭
      const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      };
      
      // 合併使用者傳入的標頭和我們的預設標頭
      const finalOptions: RequestInit = {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      };

      // 呼叫原生的 fetch
      return fetch(url, finalOptions);
    },
    [session?.accessToken, status] // 依賴項
  );

  return (
    <ProtectedFetchContext.Provider value={{ protectedFetch }}>
      {children}
    </ProtectedFetchContext.Provider>
  );
}

// 建立一個自訂 Hook，讓子元件可以輕鬆地使用我們的 protectedFetch
export function useProtectedFetch() {
  const context = useContext(ProtectedFetchContext);
  if (!context) {
    throw new Error('useProtectedFetch must be used within a ProtectedFetchProvider');
  }
  if (!context.protectedFetch) {
    // 這種情況可能發生在 session 還在 loading 時，可以根據需求處理
    // 這裡我們暫時回傳一個會報錯的函式，或可以回傳 null
    return { 
        protectedFetch: () => { throw new Error('Protected fetch is not available yet.'); } 
    };
  }
  return context;
}