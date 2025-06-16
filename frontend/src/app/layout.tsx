// app/layout.tsx

import { AuthProvider } from '@/lib/AuthContext';
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from '@/components/ui/Navbar'; 
import Footer from '@/components/ui/Footer';
import "./globals.css";
import Script from 'next/script'; 

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: 'LaLaE',
  description: 'Migrated from Django to Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="X-UA-Compatible" content="ie=edge" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-background font-sans antialiased">
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">{children}</main> 
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}