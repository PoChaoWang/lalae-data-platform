'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 定義使用者物件的型別
interface User {
  isAuthenticated: boolean;
  username?: string;
}

// 定義 Context 的內容
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 這是主要的 Provider 元件
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 當元件掛載時，呼叫 Django API 來檢查使用者狀態
    const checkStatus = async () => {
      try {
        // 確保你傳送了憑證 (cookie)
        const response = await fetch('http://localhost:8000/users/api/status/', {
          credentials: 'include', // ★★★ 這是關鍵！★★★
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          setUser({ isAuthenticated: false });
        }
      } catch (error) {
        console.error('Unable to fetch user status from Django API:', error);
        setUser({ isAuthenticated: false });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []); // 空依賴陣列確保只執行一次

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// 建立一個自定義 Hook，方便其他元件使用
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}