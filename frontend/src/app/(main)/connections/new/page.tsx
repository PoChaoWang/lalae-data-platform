// /app/(main)/connections/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from "next-auth/react";
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';
import SelectClientStep from '@/components/connections/SelectClientStep';
import SelectDataSourceStep from '@/components/connections/SelectDataSourceStep';
import ConnectionForm from '@/components/connections/ConnectionForm';
import { SelectableClient, DataSource, Connection } from '@/lib/definitions'; 
import ProtectedComponent from '@/components/ProtectedComponent'; 
import { ArrowLeft, ArrowRight, Check, Users, Database, Zap } from 'lucide-react'; // Import icons

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function NewConnectionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [selectedClient, setSelectedClient] = useState<SelectableClient | null>(null);
    const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
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
      const cloneId = searchParams.get('cloneFrom');
      const stepParam = searchParams.get('step');
      const clientId = searchParams.get('client_id');
      const dataSourceName = searchParams.get('data_source_name');

      try {
        if (cloneId) {
          // --- 處理複製邏輯 (最高優先級) ---
          const connRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/${cloneId}/`);
          if (!connRes.ok) throw new Error('Failed to fetch data for cloning.');
          const clonedConnectionData: Connection = await connRes.json();

          const fullClientId = clonedConnectionData.client.id;

          const fullClientRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/clients/${fullClientId}/`, { 
            cache: 'no-store' 
          });
          if (!fullClientRes.ok) throw new Error('Failed to fetch full client details.');
          const fullClientData: SelectableClient = await fullClientRes.json();
          
          setSelectedClient(fullClientData); 
          setSelectedDataSource(clonedConnectionData.data_source);
          setInitialDataForForm({
            displayName: `${clonedConnectionData.display_name} (Copy)`,
            config: clonedConnectionData.config
          });
          setStep(3); // 直接跳到第三步

        } else if (clientId) {
          if (!selectedClient) {
            // 如果使用者是透過直接貼上 URL 進來的，我們還是需要 fetch 一次
            const clientRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/clients/{clientId}/`, { 
                cache: 'no-store'
            });
            if (!clientRes.ok) throw new Error('Failed to fetch client data.');
            const clientData: SelectableClient = await clientRes.json();
            setSelectedClient(clientData);
            }

          if (stepParam === '3' && dataSourceName) {
            const dataSourceRes = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/datasources/${dataSourceName}/`, {
                cache: 'no-store'
            });
            if (!dataSourceRes.ok) throw new Error('Failed to fetch data source data.');
            const dataSourceData: DataSource = await dataSourceRes.json();
            setSelectedDataSource(dataSourceData);
            setStep(3);
          } else if (stepParam === '2') {
            setStep(2);
          } else {
            setStep(1);
          }
        } else {
          // --- 預設情況 ---
          setStep(1);
        }
      } catch (error) {
          console.error("Failed to initialize page:", error);
          router.replace('/connections/new'); // 如果出錯，重置到第一步
      } finally {
          setIsLoading(false);
      }
    };

    initializePage();
  }, [searchParams, router, protectedFetch, selectedClient]);

  const handleClientSelect = (client: SelectableClient) => {
    setSelectedClient(client);
    router.push(`/connections/new?step=2&client_id=${client.id}`);
};

const handleDataSourceSelect = (dataSource: DataSource) => {
    const clientId = searchParams.get('client_id');
    router.push(`/connections/new?step=3&client_id=${clientId}&data_source_name=${dataSource.name}`);
};

const handleBack = () => {
    router.back(); // Simplifies back navigation
};

// --- ✨ DYNAMIC TITLE AND STEP CONFIG ---
const stepConfig = [
    { number: 1, title: "Select Client", icon: <Users className="w-6 h-6" /> },
    { number: 2, title: "Select Data Source", icon: <Database className="w-6 h-6" /> },
    { number: 3, title: "Configure Connection", icon: <Zap className="w-6 h-6" /> },
];

const getTitle = () => {
   if (step === 3 && selectedDataSource) return `Configure ${selectedDataSource.display_name}`;
   if (step === 2 && selectedClient) return `Select Data Source for ${selectedClient.name}`;
   return stepConfig.find(s => s.number === step)?.title || "Create New Connection";
};

// --- ✨ RENDER METHODS FROM WIZARD ---
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

// --- ✨ MAIN RENDER WITH NEW WIZARD STYLING ---
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

            {/* Main Content, Centered */}
            <div className="relative z-10 max-w-4xl mx-auto">
                {/* Back Navigation */}
                <div className="mb-8">
                    <button onClick={() => step === 1 ? router.push('/connections') : handleBack()} className="flex items-center space-x-2 text-gray-400 hover:text-orange-400 transition-colors duration-300 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                        <span>{step === 1 ? 'Back to Connections' : 'Back'}</span>
                    </button>
                </div>

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent mb-2">
                        Create New Connection
                    </h1>
                    <p className="text-gray-400">Set up a new data source connection</p>
                </div>

                {renderStepIndicator()}

                {/* Step Content Card */}
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
                            {step === 1 && <SelectClientStep onClientSelect={handleClientSelect} selectedClient={selectedClient} />}
                            {step === 2 && selectedClient && <SelectDataSourceStep onDataSourceSelect={handleDataSourceSelect} selectedDataSource={selectedDataSource} />}
                            {step === 3 && selectedClient && selectedDataSource && <ConnectionForm client={selectedClient} dataSource={selectedDataSource} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    </ProtectedComponent>
);
}