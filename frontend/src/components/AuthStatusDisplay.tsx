// components/AuthStatusDisplay.tsx
import React, { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link'; // 引入 Link 組件
import LoadingSpinner from '@/components/ui/LoadingSpinner'; // 引入你的 LoadingSpinner
import {AlertTriangle, Info} from 'lucide-react';
interface AuthStatusDisplayProps {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  sessionError: string | undefined;
  callbackUrl?: string;
}

const AuthStatusDisplay: React.FC<AuthStatusDisplayProps> = ({ status, sessionError, callbackUrl = '/login' }) => {

  // 處理 RefreshTokenExpired 的副作用 (登出並重定向)
  useEffect(() => {
    if (sessionError === 'RefreshTokenExpired') {
      console.log('Refresh token expired, redirecting to login.');
      signOut({ callbackUrl: callbackUrl });
    }
  }, [sessionError, callbackUrl]);

  // 如果正在載入，顯示載入訊息和 spinner
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-gray-700">
        <LoadingSpinner /> 
        <p className="mt-4 text-lg">Loading your data...</p>
      </div>
    );
  }

  // 處理 RefreshTokenExpired 錯誤，並顯示重定向訊息 (包含連結)
  if (sessionError === 'RefreshTokenExpired') {
    return (
      <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-6 flex items-center space-x-4 max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-red-400"/>
        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div>
          <h3 className="text-xl font-bold text-red-300">Session Expired</h3>
          <p className="text-red-400 mt-1">
            Your session has expired. Redirecting to{' '}
            <Link href={callbackUrl} className="text-blue-300 hover:underline">
              login page
            </Link>...
          </p>
        </div>
      </div>
    );
  }

  // 處理其他錯誤訊息 (例如 "Please refresh the page...")
  if (sessionError) {
    return (
      <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-6 flex items-center space-x-4 max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-yellow-400"/>
        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div>
          <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
          <p className="text-red-400 mt-1">{sessionError}</p>
        </div>
      </div>
    );
  }

  // 處理未認證狀態
  if (status === 'unauthenticated') {
    return (
      <div className="bg-blue-900/50 border border-blue-500/50 rounded-lg p-6 flex items-center space-x-4 max-w-lg mx-auto">
        <Info className="w-10 h-10 text-yellow-400"/>
         <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <h3 className="text-xl font-bold text-blue-300">Authentication Required</h3>
          <p className="text-blue-400 mt-1">
            You are not authenticated. Please{' '}
            <Link href={callbackUrl} className="text-blue-300 hover:underline">
              log in
            </Link>{' '}
            to view this content.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthStatusDisplay;