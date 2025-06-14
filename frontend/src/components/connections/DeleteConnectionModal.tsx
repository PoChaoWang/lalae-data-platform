// /components/connections/DeleteConnectionModal.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

export default function DeleteConnectionModal({ isOpen, onClose, connectionId, connectionName, csrfToken }: { isOpen: boolean; onClose: () => void; connectionId: number; connectionName: string; csrfToken: string | null;}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    if (!csrfToken) {
      alert('Security token is missing. Cannot delete.');
      setIsDeleting(false);
      return;
    }

    try {
      console.log('Deleting with CSRF Token:', csrfToken);
      const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${connectionId}/`, {
          method: 'DELETE',
          headers: {
              'X-CSRFToken': csrfToken || '',
          },
          credentials: 'include',
      });

      if (res.ok || res.status === 204) { // 204 No Content 也算成功
          onClose();
          router.push('/connections');
          router.refresh();
      } else {
          throw new Error('Failed to delete the connection.');
      }
    } catch (error) {
        console.error(error);
        alert('An error occurred while deleting.');
    } finally {
        setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Confirm Delete Connection</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <p>Are you sure you want to delete <strong>{connectionName}</strong>?</p>
            <div className="alert alert-warning">This action cannot be undone.</div>
          </div>
          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-outline-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={isDeleting} className="btn btn-danger">
              {isDeleting ? 'Deleting...' : 'Delete Connection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
