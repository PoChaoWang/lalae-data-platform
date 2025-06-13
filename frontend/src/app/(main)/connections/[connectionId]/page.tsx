// /app/(main)/connections/[connectionId]/page.tsx
import ConnectionDetail from '@/components/connections/ConnectionDetail';

// Pleae change the URL in the env.local file if you need
// const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL || 'http://localhost:8000';
const NEXT_PUBLIC_TO_BACKEND_URL = process.env.NEXT_PUBLIC_TO_BACKEND_URL

async function getConnection(id: string) {
    const res = await fetch(`${NEXT_PUBLIC_TO_BACKEND_URL}/connections/api/connections/${id}/`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch connection details');
    return res.json();
  }
  
  export default async function ConnectionDetailPage({ params }: { params: { connectionId: string } }) {
    const connection = await getConnection(params.connectionId);
    return <ConnectionDetail initialConnection={connection} />;
  }
  