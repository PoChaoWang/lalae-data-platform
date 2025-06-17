// app/components/clients/ClientForm.tsx
"use client"

import { useState, useEffect, FormEvent } from "react"
import type { Client } from "@/lib/definitions"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Users, Zap, X, AlertCircle } from "lucide-react"

interface ClientFormProps {
  initialData?: Client | null 
  onSuccess: () => void 
  onCancel: () => void 
}

export default function ClientForm({
  initialData = null,
  onSuccess,
  onCancel,
}: ClientFormProps) {

  const [name, setName] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, any>>({})
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  
  const isEditMode = initialData !== null

  useEffect(() => {
    const fetchCsrfToken = async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/clients/csrf/`, {
              credentials: 'include'
          });
          if (!res.ok) {
              throw new Error('Failed to fetch CSRF token from server.');
          }
          const data = await res.json();
          setCsrfToken(data.csrfToken); 
          console.log("CSRF token fetched and stored in state.");
        } catch (error) {
          console.error("Failed to fetch CSRF token:", error);
          // 可以在此設定錯誤訊息到畫面上
          setErrors({ form: ["Security token initialization failed. Please refresh."] });
        }
      };
  
      fetchCsrfToken();
  }, []);

  useEffect(() => {
    if (isEditMode) {
      setName(initialData.name)
      setIsActive(initialData.is_active)
    }
  }, [initialData, isEditMode])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    if (!csrfToken) {
        setErrors({ form: ["Security token not found. Please refresh and try again."] });
        setIsSubmitting(false);
        return;
      }

    const apiUrl = isEditMode
      ? `${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/clients/${initialData.id}/`
      : `${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/clients/`
    const method = isEditMode ? "PUT" : "POST"

    try {
        const response = await fetch(apiUrl, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
            name,
            is_active: isActive,
        }),
        })

        if (response.ok) {
            onSuccess()
        } else {
            const errorData = await response.json()
            if (typeof errorData === "object" && errorData !== null) {
                const backendErrors = { ...errorData };
                if (backendErrors.non_field_errors) {
                    backendErrors.form = backendErrors.non_field_errors;
                    delete backendErrors.non_field_errors;
                } else if (backendErrors.detail) {
                    backendErrors.form = [backendErrors.detail];
                    delete backendErrors.detail;
                }
                setErrors(backendErrors);
            } else {
                setErrors({ form: ["An unexpected error occurred."] })
            }
        }
    } catch (error) {
        setErrors({ form: ["Internet connection error. Please try later."] })
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10" noValidate>
            {errors.form && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-300 p-3 rounded-lg text-sm space-y-1">
                    {Array.isArray(errors.form) ? errors.form.map((err: string, i: number) => (
                        <div key={i} className="flex items-start space-x-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>
                            <span>{err}</span>
                        </div>
                    )) : <p>{errors.form}</p>}
                </div>
            )}
        
            {/* Sizing Change: Increased text size and input height/padding */}
            <div className="space-y-3">
                <Label htmlFor="name" className="text-orange-400 font-semibold flex items-center space-x-2 text-lg">
                    <Zap className="w-5 h-5" />
                    <span>Client Name</span>
                </Label>
                <div className="relative">
                    <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Fill in the client name"
                        required
                        disabled={isSubmitting}
                        className={`bg-gray-900/50 border-gray-600/50 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-16 px-4 text-xl ${errors.name ? 'border-red-500/50 focus:border-red-500' : ''}`}
                    />
                    <div className={`absolute inset-0 rounded-md opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none ${errors.name ? 'bg-red-500/10' : 'bg-orange-500/10'}`} />
                </div>
                {errors.name && (
                    <div className="text-red-400 text-sm space-y-1 mt-1">
                        {errors.name.map((err: string, i: number) => <p key={i}>{err}</p>)}
                    </div>
                )}
            </div>

            {/* Sizing Change: Increased text size and container padding */}
            <div className="space-y-4">
              <Label className="text-orange-400 font-semibold flex items-center space-x-2 text-lg">
                <div className="w-5 h-5 bg-orange-500 rounded-full animate-pulse" />
                <span>Status</span>
              </Label>
                <div className={`relative w-full h-16 bg-gray-900/50 rounded-lg p-2 flex items-center border transition-colors ${errors.is_active ? 'border-red-500/50' : 'border-gray-700/50'}`}>
                    {/* Sliding background element */}
                  <div
                        className="absolute top-2 left-2 w-[calc(50%-8px)] h-[calc(100%-16px)] bg-orange-500 rounded-md transition-transform duration-300 ease-in-out"
                        style={{ transform: isActive ? 'translateX(calc(100% + 8px))' : 'translateX(0)' }}
                    />
                    {/* Inactive Button */}
                    <button
                        type="button"
                        onClick={() => setIsActive(false)}
                        disabled={isSubmitting}
                        className={`relative w-1/2 h-full rounded-md text-lg font-medium transition-colors duration-300 z-10 ${!isActive ? 'text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        Inactive
                    </button>
                    {/* Active Button */}
                    <button
                        type="button"
                        onClick={() => setIsActive(true)}
                        disabled={isSubmitting}
                        className={`relative w-1/2 h-full rounded-md text-lg font-medium transition-colors duration-300 z-10 ${isActive ? 'text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        Active
                    </button>
                </div>
                {/* Description Text */}
                <div className="px-1 pt-1">
                    <p className="text-base text-gray-400">
                        {isActive ? "Client will be immediately available for use." : "Client will be saved but cannot be used until activated."}
                    </p>
                </div>
                {errors.is_active && (
                    <div className="text-red-400 text-sm space-y-1 mt-1">
                        {errors.is_active.map((err: string, i: number) => <p key={i}>{err}</p>)}
                    </div>
                )}
            </div>
            
            {/* Sizing Change: Increased button height and text size */}
            <div className="flex space-x-4 pt-6">
                <Button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-bold h-16 text-lg rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    <span className="relative z-10 flex items-center justify-center space-x-2">
                        {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            <span>{isEditMode ? "Updating..." : "Creating..."}</span>
                        </>
                        ) : (
                        <>
                            <Users className="w-5 h-5" />
                            <span>{isEditMode ? "Update Client" : "Create Client"}</span>
                        </>
                        )}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-500 transition-all duration-300 h-16 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <X className="w-5 h-5 mr-2" />
                    Cancel
                </Button>
            </div>
        </form>
    </div>
  )
}