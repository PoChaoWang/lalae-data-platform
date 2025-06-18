// /components/connections/DeleteConnectionModal.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

import { useProtectedFetch } from '@/contexts/ProtectedFetchContext';

const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL;

export default function DeleteConnectionModal({ isOpen, onClose, connectionId, connectionName }: { isOpen: boolean; onClose: () => void; connectionId: number; connectionName: string;}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // ✨ 使用 useProtectedFetch hook
  const { protectedFetch } = useProtectedFetch();

  const handleDelete = async () => {
    setIsDeleting(true);

    if (!protectedFetch) { // ✨ 確保 protectedFetch 已準備好
      alert('Authentication is not ready. Cannot delete.');
      setIsDeleting(false);
      return;
    }

    try {
      const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/${connectionId}/`, {
          method: 'DELETE',
          // ✨ 移除 X-CSRFToken header，protectedFetch 會自動加入 Authorization header
          // headers: { 'X-CSRFToken': csrfToken || '' },
          // credentials: 'include', // JWT 通常不需要這個
      });

      if (res.ok || res.status === 204) {
          onClose();
          router.push('/connections');
          router.refresh();
      } else {
          // 嘗試解析錯誤訊息
          const errorData = await res.json();
          throw new Error(errorData.detail || 'Failed to delete the connection.');
      }
    } catch (error: any) {
        console.error("Deletion error:", error); // 打印詳細錯誤
        alert(`An error occurred while deleting: ${error.message || 'Unknown error'}`);
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-red-500/50 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-400 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Delete Connection</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400 pt-2">
            This action cannot be undone. This will permanently delete the 
            <span className="text-white font-semibold"> "{connectionName}" </span> 
            connection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="confirm-delete" className="text-gray-400">
              Please type <span className="text-white font-bold">{connectionName}</span> to confirm:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button onClick={onClose} variant="outline" className="border-gray-600 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== connectionName}
              className="bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'I understand, delete this connection'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}