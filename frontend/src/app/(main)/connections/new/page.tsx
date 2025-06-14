// /app/(main)/connections/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SelectClientStep from '@/components/connections/SelectClientStep';
import SelectDataSourceStep from '@/components/connections/SelectDataSourceStep';
import ConnectionForm from '@/components/connections/ConnectionForm';
import Link from 'next/link';
import { SelectableClient, DataSource, Connection } from '@/lib/definitions'; 
import ProtectedComponent from '@/components/ProtectedComponent'; 

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

export default function NewConnectionPage() {

  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<SelectableClient | null>(null);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [initialDataForForm, setInitialDataForForm] = useState<{
    displayName: string;
    config: any;
  } | null>(null);

  useEffect(() => {
    const initializePage = async () => {
      setIsLoading(true);
      const cloneId = searchParams.get('cloneFrom');
      const stepParam = searchParams.get('step');
      const clientId = searchParams.get('client_id');
      const dataSourceName = searchParams.get('data_source_name');

      try {
        if (cloneId) {
          // --- 處理複製邏輯 (最高優先級) ---
          const connRes = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${cloneId}/`, { credentials: 'include' });
          if (!connRes.ok) throw new Error('Failed to fetch data for cloning.');
          const clonedConnectionData: Connection = await connRes.json();

          const fullClientId = clonedConnectionData.client.id;

          const fullClientRes = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/clients/${fullClientId}/`, { 
            credentials: 'include',
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
          // --- 處理正常的分步流程 ---
          const clientRes = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/clients/${clientId}/`, { 
              credentials: 'include',
              cache: 'no-store'
          });
          if (!clientRes.ok) throw new Error('Failed to fetch client data.');
          const clientData: SelectableClient = await clientRes.json();
          setSelectedClient(clientData); 

          if (stepParam === '3' && dataSourceName) {
            const dataSourceRes = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/datasources/${dataSourceName}/`, {
                credentials: 'include',
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
  }, [searchParams, router]);

  const handleClientSelect = (client: SelectableClient) => {
    router.push(`/connections/new?step=2&client_id=${client.id}`);
  };

  const handleDataSourceSelect = (dataSource: DataSource) => {
    const clientId = searchParams.get('client_id');
    router.push(`/connections/new?step=3&client_id=${clientId}&data_source_name=${dataSource.name}`);
  };

  const handleBack = () => {
    if (step === 2) setSelectedClient(null);
    if (step === 3) setSelectedDataSource(null);
    setStep(prev => prev > 1 ? prev - 1 : 1);
  };

  const getTitle = () => {
    if (step === 1) return 'Step 1: Select a Client';
    if (step === 2) return `Step 2: Select Data Source for ${selectedClient?.name}`;
    if (step === 3) return `Step 3: Configure ${selectedDataSource?.display_name}`;
    return 'Create New Connection';
  };
  
  const backButtonUrl = step === 1 ? "/connections" : "#";

  return (
    <ProtectedComponent>
        <div className="container">
            <div className="d-flex justify-content-between align-items-center content-header">
                <h2>{getTitle()}</h2>
                <Link href={backButtonUrl} onClick={(e) => { if(backButtonUrl ==='#') { e.preventDefault(); handleBack(); } }} className="btn btn-outline-secondary">Back</Link>
            </div>

            {step === 1 && <SelectClientStep onClientSelect={handleClientSelect} />}
            {step === 2 && selectedClient && <SelectDataSourceStep onDataSourceSelect={handleDataSourceSelect} />}
            {step === 3 && selectedClient && selectedDataSource && <ConnectionForm client={selectedClient} dataSource={selectedDataSource} />}
        </div>
    </ProtectedComponent>
    
  );
}