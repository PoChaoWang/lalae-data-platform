// src/app/(auth)/reset-password/page.tsx

"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Mail, Lock, Check, X, Eye, EyeOff } from "lucide-react"
import CyberpunkBackground from "@/components/CyberpunkBackground";

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    if (!email || !newPassword || !confirmNewPassword) {
      setError("Please fill in all required fields.");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      // 這裡你需要替換為你實際的 Django 重設密碼 API 端點
      const response = await fetch(`${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/auth/reset-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          new_password1: newPassword,
          new_password2: confirmNewPassword,
          // 你可能需要在此處添加一個 token 或 uid，取決於你的 Django 後端如何處理重設密碼流程
          // 例如: token: router.query.token, uid: router.query.uid
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = Object.values(data).flat().join(' ');
        throw new Error(errorMsg || "Password reset failed. Please try again.");
      }

      setSuccessMessage("Your password has been reset successfully. You can now log in with your new password.");
      // 成功後可以考慮導向登入頁面或顯示成功訊息
      // router.push("/login");

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isNewPasswordValid = newPassword.length >= 8
  const newPasswordsMatch = newPassword === confirmNewPassword && newPassword.length > 0
  const isFormValid = email && newPassword && confirmNewPassword && isNewPasswordValid && newPasswordsMatch

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden flex pt-12 pb-10 justify-center">
      <CyberpunkBackground />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-gray-800/20 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-8 shadow-2xl shadow-orange-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent animate-pulse pointer-events-none" />
          <div className="absolute inset-0 rounded-2xl border border-orange-500/50 animate-pulse" />

          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  LaLaE
                </h1>
                <div className="ml-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent mb-2">
                Reset Your Password
              </h2>
              <p className="text-gray-400">Enter your new password below</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* Email Field - Typically for password reset *confirmation* page,
                  but sometimes used for initial "forgot password" flow.
                  If this is a *confirmation* page (user clicked link from email),
                  you might not need this field, or it might be pre-filled/hidden.
              */}
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

              {/* New Password Field */}
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-orange-400 font-semibold flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>New Password</span>
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    required
                    autoComplete="new-password"
                    className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors duration-300"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <div className="absolute inset-0 rounded-md bg-orange-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
                {/* Password Requirements */}
                {newPassword && (
                  <div className="flex items-center space-x-2 text-sm">
                    {isNewPasswordValid ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span className={isNewPasswordValid ? "text-green-400" : "text-red-400"}>At least 8 characters</span>
                  </div>
                )}
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword" className="text-orange-400 font-semibold flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Confirm New Password</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    required
                    className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors duration-300"
                  >
                    {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <div className="absolute inset-0 rounded-md bg-orange-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
                {/* Password Match Indicator */}
                {confirmNewPassword && (
                  <div className="flex items-center space-x-2 text-sm">
                    {newPasswordsMatch ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span className={newPasswordsMatch ? "text-green-400" : "text-red-400"}>
                      {newPasswordsMatch ? "Passwords match" : "Passwords don't match"}
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-center p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="text-center p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
                  <p className="text-green-400">{successMessage}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 text-lg rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Resetting Password...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      <span>Reset Password</span>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-orange-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-300" />
              </Button>
            </form>

            {/* Back to Login Link */}
            <div className="text-center mt-8 pt-6 border-t border-gray-700/50">
              <p className="text-gray-400">
                Remember your password?{" "}
                <Link href="/login" className="text-orange-400 hover:text-orange-300 transition-colors duration-300 font-semibold relative group">
                  Login
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="absolute -top-4 -right-4 w-8 h-8 border border-orange-500/30 rounded-full animate-pulse" />
        <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-orange-500/20 rounded-full animate-bounce" />
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