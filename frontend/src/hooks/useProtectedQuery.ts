// hooks/useProtectedQuery.ts
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// 這個 Hook 接受一個 API 路徑作為參數，使其更有彈性
export function useProtectedQuery<T>(apiUrl: string) {
  const { data: session, status } = useSession();
  
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 我們可以結合 session 的 loading 狀態和我們自己的 fetching 狀態
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (token: string) => {
      // 一旦開始 fetch，就設定為 loading (如果需要更精細的控制)
      // setIsLoading(true); // 這裡可以根據需求調整

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            errorData = { detail: await response.text() };
          }
          throw new Error(errorData.detail || "Failed to fetch data.");
        }

        const result = await response.json();
        setData(result);
        setError(null); // 成功後清除舊的錯誤

      } catch (e: any) {
        setError(e.message);
        setData(null); // 失敗後清除舊的資料
      } finally {
        // 無論成功或失敗，都結束載入狀態
        setIsLoading(false);
      }
    };

    // 只有在明確驗證成功，且 accessToken 存在時，才執行 fetch
    if (status === "authenticated" && session?.accessToken) {
      fetchData(session.accessToken);
    } else if (status !== "loading") {
      // 如果狀態不是 loading (例如是 'unauthenticated')，
      // 我們就不發送請求，並直接結束載-入狀態
      setIsLoading(false);
    }
    
  }, [apiUrl, session, status]);

  // 回傳頁面需要的所有狀態
  return { data, error, isLoading };
}