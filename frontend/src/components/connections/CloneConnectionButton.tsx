// /components/connections/CloneConnectionButton.tsx
'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

export default function CloneConnectionButton({ connectionId }: { connectionId: number; }) {
  const router = useRouter();

  const handleClone = () => {
    const params = new URLSearchParams();
    params.set('cloneFrom', connectionId.toString());
    router.push(`/connections/new?${params.toString()}`);
  };

  // ✨ 使用新的 Button 元件
  return (
    <Button
      onClick={handleClone}
      variant="outline"
      className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50"
    >
      <Copy className="w-4 h-4 mr-2" />
      Clone Connection
    </Button>
  );
}