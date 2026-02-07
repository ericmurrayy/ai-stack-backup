// Murray's FSM - Dashboard Layout
// =================================

import { Sidebar } from '@/components/layout/Sidebar';
import { AIAssistant } from '@/components/ai/AIAssistant';
import { CommandPalette } from '@/components/ui/CommandPalette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      <AIAssistant />
      <CommandPalette />
    </div>
  );
}
