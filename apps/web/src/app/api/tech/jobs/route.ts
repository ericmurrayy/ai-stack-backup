import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function GET(request: NextRequest) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (!supabase) {
    // Return mock data
    return NextResponse.json({
      jobs: [
        {
          id: '1',
          title: 'AC Repair',
          customer_name: 'John Smith',
          customer_phone: '(555) 123-4567',
          address: '123 Main St, Austin, TX 78701',
          scheduled_time: '9:00 AM',
          status: 'scheduled',
          quoted_amount: 450,
          notes: 'AC not cooling. Unit is about 10 years old.',
          priority: 'urgent',
        },
        {
          id: '2',
          title: 'Furnace Tune-Up',
          customer_name: 'Sarah Johnson',
          customer_phone: '(555) 234-5678',
          address: '456 Oak Ave, Austin, TX 78702',
          scheduled_time: '11:00 AM',
          status: 'scheduled',
          quoted_amount: 129,
          notes: 'Annual maintenance check.',
          priority: 'normal',
        },
        {
          id: '3',
          title: 'Water Heater Repair',
          customer_name: 'Mike Davis',
          customer_phone: '(555) 345-6789',
          address: '789 Elm Blvd, Austin, TX 78703',
          scheduled_time: '2:00 PM',
          status: 'scheduled',
          quoted_amount: 250,
          notes: 'No hot water. Pilot light may be out.',
          priority: 'normal',
        },
      ],
    });
  }

  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        description,
        status,
        scheduled_date,
        scheduled_time,
        quoted_amount,
        customer:customers(
          name,
          phone,
          address,
          city,
          state,
          zip
        )
      `)
      .gte('scheduled_date', today.toISOString())
      .lt('scheduled_date', tomorrow.toISOString())
      .in('status', ['pending', 'scheduled', 'in_progress'])
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    // Transform data
    const transformedJobs = (jobs || []).map((job: any) => {
      const customer = Array.isArray(job.customer) ? job.customer[0] : job.customer;
      return {
        id: job.id,
        title: job.title,
        customer_name: customer?.name || 'Unknown',
        customer_phone: customer?.phone,
        address: customer
          ? `${customer.address || ''}, ${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`.trim()
          : 'No address',
        scheduled_time: job.scheduled_time,
        status: job.status,
        quoted_amount: job.quoted_amount,
        notes: job.description,
        priority: 'normal', // Would need to add priority field to jobs table
      };
    });

    return NextResponse.json({ jobs: transformedJobs });
  } catch (error) {
    console.error('Error fetching tech jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { jobId, status } = body;

  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  try {
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // If completing, add completed_at timestamp
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) throw error;

    // If job was completed, trigger invoice and review request
    if (status === 'completed') {
      // This would normally be handled by a webhook or background job
      // For now, just log it
      console.log(`[Tech] Job ${jobId} completed - triggering invoice and review`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}
