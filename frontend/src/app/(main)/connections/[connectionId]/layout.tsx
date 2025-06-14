// /frontend/src/app/connections/[connectionId]/layout.tsx
import React from 'react';

// layout.tsx 必須接收 children 並且渲染它
export default function ConnectionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}