// app/(routes)/clients/new/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import ProtectedComponent from '@/components/ProtectedComponent';
import ClientForm from '@/components/clients/ClientForm';
import { ArrowLeft, Users } from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();

  // Handler for successful submission
  const handleSuccess = () => {
    // In a real app, you might show a toast notification
    console.log('Client created successfully!');
    router.push('/clients');
    router.refresh(); 
  };
  
  // Handler for cancellation
  const handleCancel = () => {
    router.push('/clients');
  };

  return (
    <ProtectedComponent>
        <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: `linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)`,
                backgroundSize: "50px 50px",
            }}/>
            
            <div className="relative z-10 min-h-screen flex items-start pt-10 justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Back Navigation */}
                    <div className="mb-8">
                        <button onClick={handleCancel} className="flex items-start space-x-2 text-gray-400 hover:text-orange-400 transition-colors duration-300 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                            <span>Back to Clients</span>
                        </button>
                    </div>

                    {/* Page Title (Moved from ClientForm) */}
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-2xl shadow-orange-500/25">
                                <Users className="w-8 h-8 text-black" />
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent mb-2">
                            Create New Client
                        </h1>
                        <p className="text-gray-400">
                            Add a new client to your account.
                        </p>
                    </div>
                
                    {/* Render the form component and pass the handlers */}
                    <ClientForm 
                        onSuccess={handleSuccess}
                        onCancel={handleCancel}
                    />
                </div>
            </div>
        </div>
    </ProtectedComponent>
  );
}