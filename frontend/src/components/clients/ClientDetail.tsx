// app/components/clients/ClientDetail.tsx
'use client'; // 標記為客戶端元件

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { Client } from '@/lib/definitions';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Database, Calendar, User, AlertTriangle, Trash2, X, Shield } from "lucide-react";
import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

export default function ClientDetail() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  // 使用 state 管理客戶資料、載入和錯誤狀態
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { protectedFetch } = useProtectedFetch();


  useEffect(() => {
    // 如果 clientId 不存在，則不執行 fetch
    if (!clientId) return;

    const fetchClient = async () => {
      if (!protectedFetch) return;
      setLoading(true);
      try {
        const response = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/clients/${clientId}/`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('The client you are looking for does not exist.');
          }
          throw new Error(`Failed to fetch client data: ${response.statusText}`);
        }
        
        const data = await response.json();
        setClient(data);
        
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientId, protectedFetch]);

  // --- Handlers ---
  const handleDeleteClient = async () => {
    if (!protectedFetch) return;
    if (!client || !isDeleteEnabled) return;
    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/clients/${client.id}/`, {
        method: 'DELETE',
      });

      if (response.status === 204) {
        alert('Client has been successfully deleted!');
        router.push('/clients');
        router.refresh();
      } else {
        const data = await response.json();
        throw new Error(data.detail || 'Deletion failed. Please try again later.');
      }
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const isDeleteEnabled = client ? deleteConfirmText === client.name : false;

  // --- Render Logic ---
  if (loading) {
    // Placeholder loading state from your template
    return (
        <div className="relative z-10 max-w-4xl mx-auto p-6">
            <div className="placeholder-glow text-transparent">
                <div className="w-1/4 h-8 bg-gray-700 rounded animate-pulse mb-8"></div>
                <div className="flex items-center space-x-4 mb-8">
                    <div className="w-16 h-16 bg-gray-700 rounded-xl animate-pulse"></div>
                    <div>
                        <div className="w-64 h-10 bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-48 h-5 bg-gray-700 rounded animate-pulse mt-2"></div>
                    </div>
                </div>
                <div className="w-full h-64 bg-gray-800/50 rounded-2xl animate-pulse"></div>
            </div>
        </div>
    );
  }

  if (error || !client) {
    return (
      <div className="text-center p-10">
        <h1 className="text-2xl text-red-400">An Error Occurred</h1>
        <p className="text-gray-400 mt-2">{error || 'The client could not be found.'}</p>
        <Link href="/clients">
            <Button variant="outline" className="mt-4">Back to Client List</Button>
        </Link>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)`, backgroundSize: "50px 50px" }} />
      
      <div className="relative z-10 max-w-4xl mx-auto p-6">
        {/* Back Navigation */}
        <div className="mb-8">
            <Link href="/clients">
                <button className="flex items-center space-x-2 text-gray-400 hover:text-orange-400 transition-colors duration-300 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
                    <span>Back to Clients</span>
                </button>
            </Link>
        </div>

        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-2xl shadow-orange-500/25">
            <Users className="w-8 h-8 text-black" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent">
              {client.name}
            </h1>
            <p className="text-gray-400 mt-1">Client Details & Configuration</p>
          </div>
        </div>

        {/* Details Panel */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 mb-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl font-semibold text-orange-400 mb-6 flex items-center space-x-2">
              <Database className="w-6 h-6" />
              <span>Client Information</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm uppercase tracking-wider">Dataset ID</Label>
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4">
                  <code className="text-orange-300 font-mono text-lg break-all">{client.bigquery_dataset_id}</code>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm uppercase tracking-wider">Created At</Label>
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <span className="text-white">{formatDate(client.created_at)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm uppercase tracking-wider">Created By</Label>
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-white">{client.created_by.toString()}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm uppercase tracking-wider">Status</Label>
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className={`font-medium ${client.is_active ? "text-green-400" : "text-gray-400"}`}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-900/10 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8 shadow-2xl shadow-red-500/10 relative">
            <h2 className="text-2xl font-semibold text-red-400 mb-2 flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6" />
                <span>Danger Zone</span>
            </h2>
            <p className="text-gray-400 mb-6">Proceed with extreme caution. These actions can lead to permanent data loss.</p>
            <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium mb-1">Delete this client</h3>
                  <p className="text-gray-400 text-sm">Once you delete a client, there is no going back.</p>
                </div>
                <Button onClick={() => setShowDeleteModal(true)} variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Client
                </Button>
              </div>
            </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800/90 backdrop-blur-sm border border-red-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-red-500/20 relative">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-red-400">Delete Client</h2>
                <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="mb-6">
                <p className="text-gray-300">This action cannot be undone. This will permanently delete <span className="text-white font-semibold">"{client.name}"</span>.</p>
              </div>
              <div className="mb-6 space-y-3">
                <Label className="text-gray-400">To confirm, please type <code className="text-orange-300 bg-gray-900/50 px-2 py-1 rounded font-mono">{client.name}</code> below:</Label>
                <Input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Enter client name" className="bg-gray-900/50 focus:border-red-500 focus:ring-red-500/20" />
                {deleteError && <p className="text-red-400 text-sm">{deleteError}</p>}
              </div>
              <div className="flex space-x-4">
                <Button onClick={handleDeleteClient} disabled={!isDeleteEnabled || isDeleting} className="flex-1" variant="destructive">
                  {isDeleting ? 'Deleting...' : 'Delete Forever'}
                </Button>
                <Button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="flex-1" variant="outline">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}