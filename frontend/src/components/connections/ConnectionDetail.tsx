// /components/connections/ConnectionDetail.tsx
'use client';
import { useState } from 'react';
import DeleteConnectionModal from './DeleteConnectionModal';
import CloneConnectionButton from './CloneConnectionButton';
import type { Connection } from '@/lib/definitions'; // ✨ 修正：從 definitions 匯入

export default function ConnectionDetail({ initialConnection }: { initialConnection: Connection }) {
  const [connection, setConnection] = useState(initialConnection);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

  return (
    <div className="container my-4">
      <div className="card">
          <div className="card-header">Details</div>
          <div className="card-body">
            <h1>{connection.display_name}</h1>
            <p>Status: {connection.status}</p>
            <h6>Config:</h6>
            <pre className="bg-light p-2 border rounded">{JSON.stringify(connection.config, null, 2)}</pre>
          </div>
      </div>
      
      <div className="d-flex justify-content-end gap-2 mt-4">
        <CloneConnectionButton connectionId={connection.id} />
        <button onClick={() => setDeleteModalOpen(true)} className="btn btn-danger">Delete Connection</button>
      </div>

      <DeleteConnectionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        connectionId={connection.id}
        connectionName={connection.display_name}
      />
    </div>
  );
}