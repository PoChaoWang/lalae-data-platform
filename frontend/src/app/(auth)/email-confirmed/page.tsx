"use client"

import Link from "next/link" 
import { Button } from "@/components/ui/button"
import { CheckCircle2, LogIn } from "lucide-react"
import CyberpunkBackground from "@/components/CyberpunkBackground";
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function EmailConfirmedContent() {
  const router = useRouter()
  const searchParams = useSearchParams() 
  const [message, setMessage] = useState('')

  const status = searchParams.get('status')
  const reason = searchParams.get('reason')

  useEffect(() => {
    if (status === 'success') {
      setMessage('Email Verified Success！')
    } else if (status === 'error') {
      switch (reason) {
        case 'expired':
          setMessage('Verification link has expired')
          break
        case 'invalid_key':
          setMessage('Invalid verification link')
          break
        default:
          setMessage('Verification failed')
      }
    }
  }, [status, reason])

  return (
    <div className="relative z-10 w-full max-w-md mx-4">
      <div className="bg-gray-800/20 backdrop-blur-xl border border-green-500/30 rounded-2xl p-8 shadow-2xl shadow-green-500/20 relative overflow-hidden">
        {/* Holographic Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent animate-pulse pointer-events-none" />

        {/* Glowing Border Animation */}
        <div className="absolute inset-0 rounded-2xl border border-green-500/50 animate-pulse" />

        <div className="relative z-10 text-center">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-green-300 bg-clip-text text-transparent mb-2">
              Account Activated
            </h2>
            <p className="text-gray-400">
              Your email has been successfully verified.
            </p>
          </div>

          {/* Call to Action */}
          <div className="space-y-6">
            <p className="text-gray-300">
              Welcome to the data revolution! You can now log in to your account.
            </p>

            {/* Login Button */}
            <Button
              asChild  
              className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 text-lg rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 relative overflow-hidden group"
            >
              <Link href="/login">
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  <LogIn className="w-5 h-5" />
                  <span>Proceed to Login</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-orange-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-300" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Additional Floating Elements */}
      <div className="absolute -top-4 -right-4 w-8 h-8 border border-green-500/30 rounded-full animate-pulse" />
      <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-green-500/20 rounded-full animate-bounce" />
    </div>
  );
}

export default function EmailConfirmedPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden flex pt-12 pb-10 justify-center">
      <CyberpunkBackground />
      <Suspense fallback={<div>Loading...</div>}> 
        <EmailConfirmedContent />
      </Suspense>

      <style jsx>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  )
}