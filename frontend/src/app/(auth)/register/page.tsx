// src/app/(auth)/register/page.tsx

"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link" 
import { Eye, EyeOff, Mail, Lock, User, UserPlus, Check, X } from "lucide-react"
import { signIn } from "next-auth/react"
import CyberpunkBackground from "@/components/CyberpunkBackground";

export default function SignUpPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("") 
  const [lastName, setLastName] = useState("") 
  const [userName, setUserName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // 驗證表單是否有效
    if (!isFormValid) {
      setError("Please fill in all required fields.");
      setIsLoading(false);
      return;
    }

    try {
      // 使用 fetch 呼叫 Django 後端的註冊 API
      const response = await fetch(`${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/auth/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          username: userName,
          email: email,
          password1: password,
          password2: confirmPassword,
          
        }),
      });
      const data = await response.json();

      
      if (!response.ok) {
       
        const errorMsg = Object.values(data).flat().join(' '); 
        throw new Error(errorMsg || "Sign up failed. Please try again.");
      }

      // 註冊成功
      alert("Sign up successful! Please check your email for verification.");
      router.push("/login"); // 導向到登入頁面

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
};

  const handleSocialSignUp = (provider: string) => {
    signIn(provider, {
      callbackUrl: "/dashboard",  // 登入成功後導向的頁面
    })
  }

  // Password validation
  const passwordsMatch = password === confirmPassword && password.length > 0
  const isPasswordValid = password.length >= 8
  const isFormValid = userName && email && password && confirmPassword && passwordsMatch && isPasswordValid

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden flex pt-12 pb-10 justify-center">
      {/* Cyberpunk Background - Same as Login */}
      <CyberpunkBackground />

      {/* Sign Up Form Card */}
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
                Create Your Account
              </h2>
              <p className="text-gray-400">Join the data revolution</p>
            </div>

            {/* Sign Up Form */}
            <form onSubmit={handleSignUp} className="space-y-6">
              {/* User Name Field */}
              <div className="space-y-2">
                <Label htmlFor="userName" className="text-orange-400 font-semibold flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>User Name</span>
                </Label>
                <div className="relative">
                  <Input
                    id="userName"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your username"
                    required
                    className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-4"
                  />
                  <div className="absolute inset-0 rounded-md bg-orange-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                {/* First Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-orange-400 font-semibold flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>First Name</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      required
                      className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-4"
                    />
                  </div>
                </div>

                {/* Last Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-orange-400 font-semibold flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>Last Name</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      required
                      className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-4"
                    />
                  </div>
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
                    placeholder="Create a password"
                    required
                    autoComplete="new-password"
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
                {/* Password Requirements */}
                {password && (
                  <div className="flex items-center space-x-2 text-sm">
                    {isPasswordValid ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span className={isPasswordValid ? "text-green-400" : "text-red-400"}>At least 8 characters</span>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-orange-400 font-semibold flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Confirm Password</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    className="bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 pl-4 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors duration-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <div className="absolute inset-0 rounded-md bg-orange-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
                {/* Password Match Indicator */}
                {confirmPassword && (
                  <div className="flex items-center space-x-2 text-sm">
                    {passwordsMatch ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span className={passwordsMatch ? "text-green-400" : "text-red-400"}>
                      {passwordsMatch ? "Passwords match" : "Passwords don't match"}
                    </span>
                  </div>
                )}
              </div>

              {/* Create Account Button */}
              {error && (
                <div className="text-center p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                  <p className="text-red-400">{error}</p>
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
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>Create Account</span>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Neon glow effect */}
                <div className="absolute inset-0 bg-orange-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-300" />
              </Button>
            </form>

            {/* Divider */}
            <div className="my-8 flex items-center">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
              <span className="px-4 text-gray-400 text-sm">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
            </div>

            {/* Social Sign Ups */}
            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => handleSocialSignUp("Google")}
                variant="outline"
                className="w-full border-gray-600/50 text-gray-300 hover:bg-gray-800/50 hover:border-orange-500/30 hover:text-white transition-all duration-300 py-3 relative group"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-800">G</span>
                  </div>
                  <span>Sign up with Google</span>
                </div>
                <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
              </Button>
              
            </div>

            {/* Login Link */}
            <div className="text-center mt-8 pt-6 border-t border-gray-700/50">
              <p className="text-gray-400">
                Already have an account?{" "}
                <Link href="/login" className="text-orange-400 hover:text-orange-300 transition-colors duration-300 font-semibold relative group">
                  Login
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
