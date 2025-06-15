// components/ui/Navbar.tsx

'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect } from 'react';
// 引入 landing page 使用的 icons
import { Globe, User, ChevronDown } from 'lucide-react';
const backendUrl = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';

export default function AppNavbar() {
    const { user, loading } = useAuth();
    const [isClient, setIsClient] = useState(false);
    
    // 控制手機版選單的展開/摺疊狀態
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
      setIsClient(true);
    }, []);

    // 處理點擊連結後關閉選單的函式
    const handleLinkClick = () => {
        setIsOpen(false);
    };

    // 在 loading 或 isClient 為 false 時，都顯示精簡版 Navbar
    if (loading || !isClient) {
        return (
            <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-orange-500/20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                            LaLaE
                        </Link>
                        <div className="ml-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    </div>
                </div>
            </header>
        );
    }
    
    // 定義連結樣式，方便共用
    const navLinkClasses = "text-gray-300 hover:text-orange-400 transition-colors duration-300 relative group px-3 py-2 text-sm font-medium";
    const mobileNavLinkClasses = "block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700";

    return (
        <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-orange-500/20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20"> {/* 增加高度以容納更豐富的內容 */}
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" onClick={handleLinkClick} className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                            LaLaE
                        </Link>
                        <div className="ml-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    </div>

                    {/* 桌面版選單 - 中心 */}
                    <nav className="hidden lg:flex items-center space-x-2">
                        {user?.isAuthenticated && (
                            <>
                                <Link href="/dashboard" className={navLinkClasses}>Dashboard<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" /></Link>
                                <Link href="/clients" className={navLinkClasses}>Clients<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" /></Link>
                                <Link href="/queries" className={navLinkClasses}>Queries<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" /></Link>
                                <Link href="/connections" className={navLinkClasses}>Connections<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" /></Link>
                            </>
                        )}
                         <Link href="/about" className={navLinkClasses}>About<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" /></Link>
                    </nav>

                    {/* 桌面版選單 - 右側 */}
                    <div className="hidden lg:flex items-center space-x-4">
                        {user?.isAuthenticated ? (
                            <>
                                
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                        <User className="w-4 h-4 text-black" />
                                    </div>
                                    <span className="text-gray-300 text-sm font-medium">{user.username}</span>
                                </div>
                                <a href={`${backendUrl}/users/logout/`} className="text-gray-400 hover:text-orange-400 transition-colors duration-300 text-sm font-medium">
                                    Logout
                                </a>
                            </>
                        ) : (
                            <>
                                <a href={`${backendUrl}/users/login/`} className="text-gray-300 hover:text-orange-400 transition-colors duration-300 font-semibold text-sm">
                                  Login
                                </a>
                                <a href={`${backendUrl}/users/register/`} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-5 py-2 rounded-lg shadow-lg hover:shadow-orange-500/25 transition-all duration-300 hover:scale-105 text-sm">
                                  Register
                                </a>
                            </>
                        )}
                    </div>

                    {/* 手機版漢堡按鈕 */}
                    <div className="lg:hidden flex items-center">
                        <button onClick={() => setIsOpen(!isOpen)} type="button" className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none">
                            <span className="sr-only">Open main menu</span>
                            <svg className={`${isOpen ? 'hidden' : 'block'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                            <svg className={`${isOpen ? 'block' : 'hidden'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* 手機版展開選單 */}
            <div className={`${isOpen ? 'block' : 'hidden'} lg:hidden border-t border-orange-500/20`} id="mobile-menu">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3" onClick={handleLinkClick}>
                    {user?.isAuthenticated && (
                        <>
                            <Link href="/dashboard" className={mobileNavLinkClasses}>Dashboard</Link>
                            <Link href="/clients" className={mobileNavLinkClasses}>Clients</Link>
                            <Link href="/queries" className={mobileNavLinkClasses}>Queries</Link>
                            <Link href="/connections" className={mobileNavLinkClasses}>Connections</Link>
                        </>
                    )}
                    <Link href="/about" className={mobileNavLinkClasses}>About</Link>
                    
                    <div className="pt-4 pb-3 border-t border-gray-700">
                        {user?.isAuthenticated ? (
                            <>
                                <div className="flex items-center px-3 mb-3">
                                    <div className="flex-shrink-0 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-black" />
                                    </div>
                                    <div className="ml-3">
                                        <div className="text-base font-medium leading-none text-white">{user.username}</div>
                                        {/* <div className="text-sm font-medium leading-none text-gray-400 mt-1">{user.email || '...'}</div>     */}
                                    </div>
                                </div>
                                <a href={`${backendUrl}/users/logout/`} className={mobileNavLinkClasses}>Logout</a>
                            </>
                        ) : (
                            <div className="space-y-1">
                                <a href={`${backendUrl}/users/login/`} className={mobileNavLinkClasses}>Login</a>
                                <a href={`${backendUrl}/users/register/`} className={mobileNavLinkClasses}>Register</a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}