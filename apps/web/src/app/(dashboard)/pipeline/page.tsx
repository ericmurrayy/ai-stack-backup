// Murray's FSM - Pipeline/Kanban View
// ====================================
// Visual job management - jobs grouped by status

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import {
  NewJobButton,
  FilterButton,
  InteractivePipelineColumn,
} from './PipelineActions';

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  bgColor: string;
}

interface JobCard {
  id: string;
  job_number: number;
  customer_name: string | null;
  phone_number: string;
  city: string | null;
  service_category: string;
  urgency: string;
  issue_description: string | null;
  scheduled_at: string | null;
  created_at: string;
}

export interface StageWithJobs extends PipelineStage {
  jobs: JobCard[];
  job_count: number;
}

async function getPipelineData(): Promise<StageWithJobs[]> {
  const supabase = createAdminClient();

  // Get all jobs
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, job_number, customer_name, phone_number, city, service_category, urgency, issue_description, scheduled_at, created_at, status')
    .eq('is_spam', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs for pipeline:', error);
  }

  // Define pipeline stages based on job statuses
  const stages: PipelineStage[] = [
    { id: 'new', name: 'New', color: '#8b5cf6', bgColor: 'bg-purple-50' },
    { id: 'contacted', name: 'Contacted', color: '#3b82f6', bgColor: 'bg-blue-50' },
    { id: 'scheduled', name: 'Scheduled', color: '#6366f1', bgColor: 'bg-indigo-50' },
    { id: 'in_progress', name: 'In Progress', color: '#f59e0b', bgColor: 'bg-yellow-50' },
    { id: 'completed', name: 'Completed', color: '#22c55e', bgColor: 'bg-green-50' },
  ];

  // Group jobs by status
  return stages.map((stage) => {
    const stageJobs = (jobs || [])
      .filter((j) => j.status === stage.id)
      .map((j) => ({
        id: j.id,
        job_number: j.job_number,
        customer_name: j.customer_name,
        phone_number: j.phone_number,
        city: j.city,
        service_category: j.service_category,
        urgency: j.urgency,
        issue_description: j.issue_description,
        scheduled_at: j.scheduled_at,
        created_at: j.created_at,
      }));

    return {
      ...stage,
      jobs: stageJobs,
      job_count: stageJobs.length,
    };
  });
}


export default async function PipelinePage() {
  const stages = await getPipelineData();

  const totalJobs = stages.reduce((sum, s) => sum + s.job_count, 0);
  const newJobs = stages.find(s => s.id === 'new')?.job_count || 0;
  const completedJobs = stages.find(s => s.id === 'completed')?.job_count || 0;

  return (
    <div className="h-full flex flex-col">
      <Header title="Job Pipeline" />

      {/* Pipeline Stats */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-2xl font-bold text-slate-900">{totalJobs}</div>
            <div className="text-sm text-slate-500">Total Jobs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{newJobs}</div>
            <div className="text-sm text-slate-500">New Leads</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{completedJobs}</div>
            <div className="text-sm text-slate-500">Completed</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <FilterButton />
            <NewJobButton />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full">
          {stages.map((stage) => (
            <InteractivePipelineColumn key={stage.id} stage={stage} />
          ))}
        </div>
      </div>
    </div>
  );
}
