'use client';

import { CheckCircle, Circle, Phone, Calendar, Wrench } from 'lucide-react';

interface JobStatusWorkflowProps {
  currentStatus: string;
  jobId: string;
}

const statuses = [
  { key: 'new', label: 'New', icon: Circle },
  { key: 'contacted', label: 'Contacted', icon: Phone },
  { key: 'scheduled', label: 'Scheduled', icon: Calendar },
  { key: 'in_progress', label: 'In Progress', icon: Wrench },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
];

export function JobStatusWorkflow({ currentStatus }: JobStatusWorkflowProps) {
  const currentIndex = statuses.findIndex(s => s.key === currentStatus);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        {statuses.map((status, index) => {
          const Icon = status.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div key={status.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-blue-500 text-white ring-4 ring-blue-200' : ''}
                    ${isFuture ? 'bg-slate-100 text-slate-400' : ''}
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium
                    ${isCompleted ? 'text-green-600' : ''}
                    ${isCurrent ? 'text-blue-600' : ''}
                    ${isFuture ? 'text-slate-400' : ''}
                  `}
                >
                  {status.label}
                </span>
              </div>

              {index < statuses.length - 1 && (
                <div
                  className={`
                    w-16 h-1 mx-2
                    ${index < currentIndex ? 'bg-green-500' : 'bg-slate-200'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
