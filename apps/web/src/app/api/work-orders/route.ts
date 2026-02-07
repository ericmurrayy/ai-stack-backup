/**
 * Work Orders API
 * ===============
 * Manage work orders and templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/work-orders
 * Get work orders or templates
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  const jobId = searchParams.get('job_id');
  const status = searchParams.get('status');
  const getTemplates = searchParams.get('templates') === 'true';

  // Return templates if requested
  if (getTemplates) {
    return NextResponse.json({
      templates: [
        {
          id: 'hvac-tune-up',
          name: 'HVAC System Tune-Up',
          category: 'hvac_maintenance',
          description: 'Complete HVAC system inspection and tune-up',
          estimated_duration: 90,
          base_price: 149,
          tasks: [
            { id: 't1', name: 'Check thermostat operation', is_required: true, order: 1 },
            { id: 't2', name: 'Inspect electrical connections', is_required: true, order: 2 },
            { id: 't3', name: 'Lubricate moving parts', is_required: true, order: 3 },
            { id: 't4', name: 'Check condensate drain', is_required: true, order: 4 },
            { id: 't5', name: 'Inspect evaporator coil', is_required: true, order: 5 },
            { id: 't6', name: 'Check refrigerant level', is_required: true, order: 6 },
            { id: 't7', name: 'Inspect blower components', is_required: true, order: 7 },
            { id: 't8', name: 'Check air filter', is_required: true, order: 8 },
            { id: 't9', name: 'Test system operation', is_required: true, order: 9 },
          ],
          materials: [
            { id: 'm1', name: 'Air Filter (standard)', quantity: 1, unit: 'each', unit_cost: 15 },
            { id: 'm2', name: 'Lubricant', quantity: 1, unit: 'can', unit_cost: 8 },
          ],
        },
        {
          id: 'ac-install',
          name: 'AC Unit Installation',
          category: 'hvac_install',
          description: 'New air conditioning unit installation',
          estimated_duration: 480,
          base_price: 2999,
          tasks: [
            { id: 't1', name: 'Site assessment', is_required: true, order: 1 },
            { id: 't2', name: 'Remove old unit', is_required: false, order: 2 },
            { id: 't3', name: 'Install outdoor condensing unit', is_required: true, order: 3 },
            { id: 't4', name: 'Install indoor evaporator coil', is_required: true, order: 4 },
            { id: 't5', name: 'Run refrigerant lines', is_required: true, order: 5 },
            { id: 't6', name: 'Connect electrical', is_required: true, order: 6 },
            { id: 't7', name: 'Install thermostat', is_required: true, order: 7 },
            { id: 't8', name: 'Evacuate and charge system', is_required: true, order: 8 },
            { id: 't9', name: 'Test operation', is_required: true, order: 9 },
            { id: 't10', name: 'Customer walkthrough', is_required: true, order: 10 },
          ],
          materials: [
            { id: 'm1', name: 'Refrigerant R-410A', quantity: 10, unit: 'lbs', unit_cost: 25 },
            { id: 'm2', name: 'Line set', quantity: 1, unit: 'set', unit_cost: 150 },
            { id: 'm3', name: 'Condenser pad', quantity: 1, unit: 'each', unit_cost: 35 },
          ],
        },
        {
          id: 'plumbing-drain-clean',
          name: 'Drain Cleaning Service',
          category: 'plumbing_service',
          description: 'Professional drain cleaning and inspection',
          estimated_duration: 60,
          base_price: 149,
          tasks: [
            { id: 't1', name: 'Assess drain condition', is_required: true, order: 1 },
            { id: 't2', name: 'Run snake/auger through drain', is_required: true, order: 2 },
            { id: 't3', name: 'Camera inspection', is_required: false, order: 3 },
            { id: 't4', name: 'Flush drain with water', is_required: true, order: 4 },
            { id: 't5', name: 'Test drainage speed', is_required: true, order: 5 },
          ],
          materials: [],
        },
        {
          id: 'water-heater-install',
          name: 'Water Heater Installation',
          category: 'plumbing_install',
          description: 'Water heater replacement or new installation',
          estimated_duration: 240,
          base_price: 899,
          tasks: [
            { id: 't1', name: 'Shut off water and gas/electric', is_required: true, order: 1 },
            { id: 't2', name: 'Drain old water heater', is_required: true, order: 2 },
            { id: 't3', name: 'Disconnect and remove old unit', is_required: true, order: 3 },
            { id: 't4', name: 'Position new water heater', is_required: true, order: 4 },
            { id: 't5', name: 'Connect water lines', is_required: true, order: 5 },
            { id: 't6', name: 'Connect gas/electric', is_required: true, order: 6 },
            { id: 't7', name: 'Fill and check for leaks', is_required: true, order: 7 },
            { id: 't8', name: 'Set temperature and test', is_required: true, order: 8 },
          ],
          materials: [
            { id: 'm1', name: 'Flexible water connectors', quantity: 2, unit: 'each', unit_cost: 15 },
            { id: 'm2', name: 'Gas flex connector', quantity: 1, unit: 'each', unit_cost: 25 },
          ],
        },
        {
          id: 'electrical-panel-inspection',
          name: 'Electrical Panel Inspection',
          category: 'electrical_service',
          description: 'Complete electrical panel safety inspection',
          estimated_duration: 60,
          base_price: 129,
          tasks: [
            { id: 't1', name: 'Visual inspection of panel', is_required: true, order: 1 },
            { id: 't2', name: 'Check for burn marks or damage', is_required: true, order: 2 },
            { id: 't3', name: 'Test breakers', is_required: true, order: 3 },
            { id: 't4', name: 'Check wire connections', is_required: true, order: 4 },
            { id: 't5', name: 'Verify proper labeling', is_required: true, order: 5 },
            { id: 't6', name: 'Measure voltage at main', is_required: true, order: 6 },
            { id: 't7', name: 'Provide written report', is_required: true, order: 7 },
          ],
          materials: [],
        },
        {
          id: 'outlet-install',
          name: 'Outlet Installation',
          category: 'electrical_install',
          description: 'Install new electrical outlet',
          estimated_duration: 60,
          base_price: 175,
          tasks: [
            { id: 't1', name: 'Turn off power at breaker', is_required: true, order: 1 },
            { id: 't2', name: 'Verify power is off', is_required: true, order: 2 },
            { id: 't3', name: 'Cut hole for outlet box', is_required: true, order: 3 },
            { id: 't4', name: 'Run wire from source', is_required: true, order: 4 },
            { id: 't5', name: 'Install outlet and test', is_required: true, order: 5 },
          ],
          materials: [
            { id: 'm1', name: 'Outlet', quantity: 1, unit: 'each', unit_cost: 5 },
            { id: 'm2', name: 'Outlet box', quantity: 1, unit: 'each', unit_cost: 3 },
            { id: 'm3', name: '14/2 Wire', quantity: 25, unit: 'ft', unit_cost: 0.5 },
          ],
        },
        {
          id: 'general-diagnostic',
          name: 'General Diagnostic Service',
          category: 'diagnostic',
          description: 'Diagnose equipment issue and provide repair estimate',
          estimated_duration: 45,
          base_price: 89,
          tasks: [
            { id: 't1', name: 'Interview customer about issue', is_required: true, order: 1 },
            { id: 't2', name: 'Visual inspection', is_required: true, order: 2 },
            { id: 't3', name: 'Test system operation', is_required: true, order: 3 },
            { id: 't4', name: 'Identify root cause', is_required: true, order: 4 },
            { id: 't5', name: 'Provide repair options', is_required: true, order: 5 },
          ],
          materials: [],
        },
      ],
    });
  }

  try {
    let query = supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (jobId) {
      query = query.eq('job_id', jobId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: workOrders, error } = await query;

    if (error) throw error;

    // Calculate stats
    const items = workOrders || [];
    const stats = {
      total: items.length,
      draft: items.filter(wo => wo.status === 'draft').length,
      assigned: items.filter(wo => wo.status === 'assigned').length,
      in_progress: items.filter(wo => wo.status === 'in_progress').length,
      completed: items.filter(wo => wo.status === 'completed').length,
    };

    return NextResponse.json({ workOrders: items, stats });
  } catch (error: any) {
    console.error('[WorkOrders API] Error:', error);

    // Return demo data on error
    return NextResponse.json({
      workOrders: [
        {
          id: '1',
          work_order_number: 'WO-2024-ABC123',
          job_id: 'job-1',
          title: 'HVAC System Tune-Up',
          category: 'hvac_maintenance',
          status: 'in_progress',
          estimated_duration: 90,
          assigned_to_name: 'Mike Johnson',
          tasks: [
            { id: 't1', name: 'Check thermostat operation', completed: true },
            { id: 't2', name: 'Inspect electrical connections', completed: true },
            { id: 't3', name: 'Lubricate moving parts', completed: false },
            { id: 't4', name: 'Check condensate drain', completed: false },
          ],
          materials: [
            { id: 'm1', name: 'Air Filter', quantity: 1, unit: 'each' },
          ],
          labor_cost: 149,
          materials_cost: 15,
          total_cost: 164,
          created_at: '2024-07-20T10:00:00Z',
        },
        {
          id: '2',
          work_order_number: 'WO-2024-DEF456',
          job_id: 'job-2',
          title: 'Drain Cleaning Service',
          category: 'plumbing_service',
          status: 'assigned',
          estimated_duration: 60,
          assigned_to_name: 'Sarah Williams',
          tasks: [
            { id: 't1', name: 'Assess drain condition', completed: false },
            { id: 't2', name: 'Run snake through drain', completed: false },
            { id: 't3', name: 'Flush and test', completed: false },
          ],
          materials: [],
          labor_cost: 149,
          materials_cost: 0,
          total_cost: 149,
          created_at: '2024-07-20T11:00:00Z',
        },
      ],
      stats: {
        total: 2,
        draft: 0,
        assigned: 1,
        in_progress: 1,
        completed: 0,
      },
    });
  }
}

/**
 * POST /api/work-orders
 * Create a new work order
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Generate work order number
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const workOrderNumber = `WO-${year}-${random}`;

    const { data, error } = await supabase
      .from('work_orders')
      .insert({
        work_order_number: workOrderNumber,
        job_id: body.job_id,
        customer_id: body.customer_id,
        template_id: body.template_id,
        title: body.title,
        description: body.description,
        category: body.category,
        tasks: body.tasks || [],
        materials: body.materials || [],
        estimated_duration: body.estimated_duration,
        assigned_to: body.assigned_to,
        assigned_to_name: body.assigned_to_name,
        labor_cost: body.labor_cost,
        materials_cost: body.materials_cost,
        total_cost: body.total_cost,
        status: body.status || 'draft',
        created_at: new Date().toISOString(),
      })
      .select('id, work_order_number')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: data.id,
      work_order_number: data.work_order_number,
    });
  } catch (error: any) {
    console.error('[WorkOrders API] Create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create work order' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/work-orders
 * Update a work order
 */
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Work order ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('work_orders')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WorkOrders API] Update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update work order' },
      { status: 500 }
    );
  }
}
