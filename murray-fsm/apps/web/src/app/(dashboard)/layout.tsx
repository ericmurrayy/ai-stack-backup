// Murray's FSM - Dashboard Layout
// =================================

import { Sidebar } from '@/components/layout/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="flex items-center justify-end px-6 py-2 bg-white border-b border-slate-200">
          <NotificationBell />
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
