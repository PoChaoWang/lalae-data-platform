// frontend/src/app/(auth)/forgot-password/page.tsx

"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, ChevronLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    // 呼叫 Django 後端的 password reset API
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/auth/password/reset/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      // 不論成功或失敗，都顯示一個通用的成功訊息
      // 這是為了安全，避免攻擊者用來探測哪些 email 已經註冊
      setMessage("We've sent you an email with instructions for resetting your password.");

    } catch (error) {
      console.error("Password reset request failed:", error);
      setMessage("請求失敗，請稍後再試。");
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden flex items-center justify-center">
      {/* --- Cyberpunk 背景 (與登入頁相同) --- */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255,165,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.3) 1px, transparent 1px)`,
            backgroundSize: "100px 100px",
          }}
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-orange-500/30 rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-24 h-24 border border-blue-500/20 rounded-full animate-ping" />
        </div>
        <div
          className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500/30"
          style={{ animation: "scan 4s linear infinite" }}
        />
      </div>

      {/* --- 表單卡片 --- */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-gray-800/20 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-8 shadow-2xl shadow-orange-500/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">
              Forgot Password?
            </h1>
            <p className="text-gray-400">No problem. We'll send you a reset link.</p>
          </div>
          
          {/* 如果有訊息，就顯示出來 */}
          {message ? (
            <div className="mb-6 text-center bg-green-900/50 border border-green-500/50 text-green-300 p-4 rounded-lg">
              <p>{message}</p>
            </div>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-orange-400 font-semibold flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Your Registered Email</span>
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-4"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 text-lg rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}

          <div className="text-center mt-8 pt-6 border-t border-gray-700/50">
            <Link href="/login" className="text-orange-400 hover:text-orange-300 transition-colors duration-300 font-semibold inline-flex items-center space-x-2 group">
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  )
}