'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Edit, Trash2, CheckCircle, Phone, Calendar, MoreVertical } from 'lucide-react';

interface JobActionsProps {
  jobId: string;
  currentStatus: string;
}

export function JobActions({ jobId, currentStatus }: JobActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
    setLoading(false);
    setShowMenu(false);
  };

  const deleteJob = async () => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/jobs');
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
    setLoading(false);
  };

  const statusActions = [
    { status: 'new', label: 'Mark as New', show: currentStatus !== 'new' },
    { status: 'contacted', label: 'Mark as Contacted', show: currentStatus === 'new' },
    { status: 'scheduled', label: 'Mark as Scheduled', show: ['new', 'contacted'].includes(currentStatus) },
    { status: 'in_progress', label: 'Start Job', show: ['scheduled', 'new', 'contacted'].includes(currentStatus) },
    { status: 'completed', label: 'Complete Job', show: currentStatus === 'in_progress' },
  ].filter(a => a.show);

  return (
    <div className="flex items-center gap-2">
      {currentStatus === 'new' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStatus('contacted')}
          disabled={loading}
        >
          <Phone className="w-4 h-4" />
          Mark Contacted
        </Button>
      )}

      {currentStatus === 'in_progress' && (
        <Button
          variant="success"
          size="sm"
          onClick={() => updateStatus('completed')}
          disabled={loading}
        >
          <CheckCircle className="w-4 h-4" />
          Complete Job
        </Button>
      )}

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMenu(!showMenu)}
          disabled={loading}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
            {statusActions.map(action => (
              <button
                key={action.status}
                onClick={() => updateStatus(action.status)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-slate-700"
              >
                {action.label}
              </button>
            ))}
            <hr className="my-1 border-slate-200" />
            <button
              onClick={deleteJob}
              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600"
            >
              Delete Job
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
