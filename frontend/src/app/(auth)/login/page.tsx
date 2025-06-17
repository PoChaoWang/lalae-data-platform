// frontend/src/app/(auth)/login/page.tsx

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { signIn } from "next-auth/react" 
import { useRouter } from "next/navigation" 
import Link from "next/link" 
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react"
import CyberpunkBackground from "@/components/CyberpunkBackground";

export default function LoginPage() {
  const router = useRouter()
  const [username, setUserName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
        // ✨ 使用 next-auth 的 signIn 函式
        const result = await signIn("credentials", {
          // 將使用者輸入的 email 和 password 傳遞過去
          email: email,
          password: password,
          // 關鍵：設定為 false，這樣頁面不會自動跳轉
          // 我們可以手動處理成功或失敗的結果
          redirect: false, 
        })
        if (result?.ok) {
            // 登入成功，導向到個人資料頁或其他受保護的頁面
            router.push("/dashboard")
          } else {
            // 登入失敗
            setError("Login failed. Please check your ID and password.")
            console.error("Login failed:", result)
          }
    } catch (error) {
        console.error("An unexpected error occurred:", error)
        setError("On unexpected error occurred. Please try again.")
    } finally {
    setIsLoading(false)
    }
  }

  const handleSocialLogin = (provider: string) => {
    setIsLoading(true); // 開始登入時，顯示讀取狀態
    signIn(provider.toLowerCase(), {
      // 告訴 NextAuth 登入成功後要跳轉到 /dashboard
      callbackUrl: "/dashboard",
    }).catch((error) => {
        // 如果在跳轉前發生錯誤，也要處理
        console.error("Social login redirect error:", error);
        setError("Occurred an unexpected error. Please try again.");
        setIsLoading(false);
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden flex pt-12 justify-center">
      <CyberpunkBackground />

      {/* Login Form Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-gray-800/20 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-8 shadow-2xl shadow-orange-500/20 relative overflow-hidden">
          {/* Holographic Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent animate-pulse pointer-events-none" />

          {/* Glowing Border Animation */}
          <div className="absolute inset-0 rounded-2xl border border-orange-500/50 animate-pulse" />

          <div className="relative z-10">
            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  LaLaE
                </h1>
                <div className="ml-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent mb-2">
                Welcome Back
              </h2>
              <p className="text-gray-400">Access your data command center</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-orange-400 font-semibold flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
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
                  <div className="absolute inset-0 rounded-md bg-orange-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-orange-400 font-semibold flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Password</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors duration-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <div className="absolute inset-0 rounded-md bg-orange-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </div>

              {error && (
                <div className="text-center p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 text-lg rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Logging In...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>Login</span>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Neon glow effect */}
                <div className="absolute inset-0 bg-orange-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-300" />
              </Button>

              {/* Forgot Password Link */}
              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-orange-400 hover:text-orange-300 transition-colors duration-300 text-sm relative group"
                >
                  Forgot Password?
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" />
                </Link>
              </div>
            </form>

            {/* Divider */}
            <div className="my-8 flex items-center">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
              <span className="px-4 text-gray-400 text-sm">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
            </div>

            {/* Social Logins */}
            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => handleSocialLogin("Google")}
                variant="outline"
                className="w-full border-gray-600/50 text-gray-300 hover:bg-gray-800/50 hover:border-orange-500/30 hover:text-white transition-all duration-300 py-3 relative group"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-800">G</span>
                  </div>
                  <span>Continue with Google</span>
                </div>
                <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
              </Button>
              
            </div>

            {/* Sign Up Link */}
            <div className="text-center mt-8 pt-6 border-t border-gray-700/50">
              <p className="text-gray-400">
                Don't have an account?{" "}
                <Link href="/register" className="text-orange-400 hover:text-orange-300 transition-colors duration-300 font-semibold relative group">
                  Sign Up
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Additional Floating Elements */}
        <div className="absolute -top-4 -right-4 w-8 h-8 border border-orange-500/30 rounded-full animate-pulse" />
        <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-orange-500/20 rounded-full animate-bounce" />
      </div>

      {/* Custom CSS for scanning animation */}
      <style jsx>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  )
}
