// frontend/src/components/queries/DeleteQueryModal.tsx
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

interface DeleteQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryId: number | null; // 可以是 null，因為初始時可能沒有選中的查詢
  queryName: string;
  onSuccess: () => void; // 刪除成功後的回調，用於刷新列表
}

export default function DeleteQueryModal({ isOpen, onClose, queryId, queryName, onSuccess }: DeleteQueryModalProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const { protectedFetch } = useProtectedFetch();

  const handleDelete = async () => {
    if (!queryId) return; // 如果沒有 queryId，則不執行任何操作

    setIsDeleting(true);

    if (!protectedFetch) {
      alert('Fetch client not initialized.');
      setIsDeleting(false);
      return;
    }

    try {
      const res = await protectedFetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/queries/delete/${queryId}/`, {
          method: 'DELETE',
      });

      if (res.ok || res.status === 204) {
          alert(`Query "${queryName}" deleted successfully!`);
          onClose();
          onSuccess(); // 調用成功回調以刷新 QueryList
      } else {
          const errorData = await res.json();
          throw new Error(errorData.message || errorData.detail || `Failed to delete the query: ${res.statusText}`);
      }
    } catch (error: any) {
        console.error("Deletion error:", error);
        alert(`An error occurred while deleting: ${error.message || 'Unknown error'}`);
    } finally {
        setIsDeleting(false);
        setConfirmText(""); // 重置確認文本
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => {
      if (!open) { // 當 Dialog 關閉時重置狀態
        setConfirmText("");
        setIsDeleting(false);
      }
      onClose();
    }}>
      <DialogContent className="bg-gray-800 border-red-500/50 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-400 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Delete Query</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400 pt-2">
            This action cannot be undone. This will permanently delete the
            <span className="text-white font-semibold"> "{queryName}" </span>
            query and all its associated execution history and results.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="confirm-delete" className="text-gray-400">
              Please type <span className="text-white font-bold">{queryName}</span> to confirm:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-2 bg-gray-900/50 border-gray-600/50 text-white"
              autoComplete="off" // 防止瀏覽器自動填充
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button onClick={onClose} variant="outline" className="border-gray-600 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== queryName}
              className="bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'I understand, delete this query'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}