// /frontend/src/app/dashboard/layout.tsx
import { ProtectedFetchProvider } from '@/contexts/ProtectedFetchContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedFetchProvider>
      {children}
    </ProtectedFetchProvider>
  );
}