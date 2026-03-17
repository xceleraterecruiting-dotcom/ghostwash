'use client';

import Sidebar from '@/components/dashboard/Sidebar';
import { useParams } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const siteId = params.siteId as string;

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">
      <Sidebar siteId={siteId} />
      <main className="ml-60 flex-1">{children}</main>
    </div>
  );
}
