import { AuthProvider } from '@/lib/AuthContext';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from 'next/script'; 
import Navbar from '@/components/ui/Navbar'; 
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'LaLaE - Next.js',
  description: 'Migrated from Django to Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* 直接放置 CSS CDN 連結 */}
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet" />
        {/* CodeMirror CSS 也可以放這裡，或者只在需要它的頁面載入 */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/monokai.min.css" />
      </head>
      <body>
        <AuthProvider>
          <Navbar /> {/* 這就是你的 {% include 'includes/navbar.html' %} */}
          <main>{children}</main> {/* 這就是你的 {% block content %} */}

          {/* 使用 Next.js 的 Script 元件來載入 JS，有助於優化效能 */}
          <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
          
          {/* CodeMirror 也可以用 Script 元件載入 */}
          <Script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js" strategy="lazyOnload" />
          <Script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/sql/sql.min.js" strategy="lazyOnload" />
          
          {/* 你自己的 common.js 也可以用 Script 元件載入 */}
          {/* <Script src="/js/common.js" /> */}
        </AuthProvider>
      </body>
    </html>
  );
}
