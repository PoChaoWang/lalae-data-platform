// /app/(main)/queries/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from "next-auth/react";
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';
import SelectClientStep from '@/components/SelectClientStep';
import QueryForm from '@/components/queries/QueryForm';
import { SelectableClient } from '@/lib/definitions';
import ProtectedComponent from '@/components/ProtectedComponent';
import { ArrowLeft, ArrowRight, Check, Users, Database, DatabaseZap } from 'lucide-react';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function NewQueriesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [selectedClient, setSelectedClient] = useState<SelectableClient | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { protectedFetch } = useProtectedFetch();

    const [initialDataForForm, setInitialDataForForm] = useState<{
        displayName: string;
        config: any;
    } | null>(null);

    useEffect(() => {
        const initializePage = async () => {
            if (!protectedFetch) {
                return;
            }
            setIsLoading(true);
            const stepParam = searchParams.get('step');
            const clientId = searchParams.get('client_id');

            try {
                if (clientId) {
                    if (!selectedClient || selectedClient.id !== clientId) {
                        const clientRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/clients/${clientId}/`, {
                            cache: 'no-store'
                        });
                        if (!clientRes.ok) throw new Error('Failed to fetch client data.');
                        const clientData: SelectableClient = await clientRes.json();
                        setSelectedClient(clientData);
                    }

                    if (stepParam === '2') {
                        setStep(2);
                    } else {
                        setStep(1);
                    }
                } else {
                    setStep(1);
                }
            } catch (error) {
                console.error("Failed to initialize page:", error);
                router.replace('/queries/new');
            } finally {
                setIsLoading(false);
            }
        };

        initializePage();
    }, [searchParams, router, protectedFetch, selectedClient]);

    const handleClientSelect = (client: SelectableClient) => {
        setSelectedClient(client);
        router.push(`/queries/new?step=2&client_id=${client.id}`);
    };

    const handleBack = () => {
        router.back();
    };

    const stepConfig = [
        { number: 1, title: "Select Client", icon: <Users className="w-6 h-6" /> },
        { number: 2, title: "Configure Query", icon: <DatabaseZap className="w-6 h-6" /> },
    ];

    const getTitle = () => {
        if (step === 2 && selectedClient) return `Query for ${selectedClient.name}`;
        return stepConfig.find(s => s.number === step)?.title || "Create New Query";
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-8">
            {stepConfig.map((s, index) => (
                <div key={s.number} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        step >= s.number ? "bg-orange-500 text-black" : "bg-gray-700 text-gray-400"
                    }`}>
                        {step > s.number ? <Check className="w-5 h-5" /> : s.number}
                    </div>
                    <div className="ml-3 text-sm">
                        <div className={step >= s.number ? "text-orange-400" : "text-gray-400"}>Step {s.number}</div>
                        <div className={step >= s.number ? "text-white" : "text-gray-500"}>{s.title}</div>
                    </div>
                    {index < stepConfig.length - 1 && <ArrowRight className="w-4 h-4 text-gray-600 mx-4" />}
                </div>
            ))}
        </div>
    );

    // ✨ 新增的邏輯：根據步驟動態調整容器寬度
    const mainContentWidthClass = step === 1 ? 'max-w-4xl mx-auto' : 'max-w-full mx-auto px-6'; // step 2 佔據更多寬度，並添加左右 padding

    return (
        <ProtectedComponent>
            <div className="min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)`,
                        backgroundSize: "50px 50px",
                    }} />
                </div>

                {/* Main Content, Centered - 使用動態寬度類 */}
                <div className={`relative z-10 ${mainContentWidthClass}`}> {/* ✨ 這裡應用動態寬度 */}
                    {/* Back Navigation */}
                    <div className="mb-8">
                        <button onClick={() => step === 1 ? router.push('/queries') : handleBack()} className="flex items-center space-x-2 text-gray-400 hover:text-orange-400 transition-colors duration-300 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                            <span>{step === 1 ? 'Back to Queries' : 'Back'}</span>
                        </button>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent mb-2">
                            Create New Query
                        </h1>
                        <p className="text-gray-400">Set up a new data query</p>
                    </div>

                    {renderStepIndicator()}

                    {/* Step Content Card - 移除自身的 max-w 限制 */}
                    <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-orange-500/10">
                       
                        {/* Dynamic Title for the current step */}
                        <h2 className="text-2xl font-semibold text-orange-400 mb-6 flex items-center space-x-2">
                           {stepConfig.find(s => s.number === step)?.icon}
                           <span>{getTitle()}</span>
                        </h2>
                       
                        {isLoading ? (
                            <div className="text-center text-gray-400">Loading...</div>
                        ) : (
                            <>
                                {/* 讓 SelectClientStep 和 QueryForm 自身不再需要 max-w-4xl mx-auto */}
                                {step === 1 && <SelectClientStep onClientSelect={handleClientSelect} selectedClient={selectedClient} />}
                                {step === 2 && selectedClient && <QueryForm client={selectedClient} initialData={initialDataForForm}/>}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedComponent>
    );
}