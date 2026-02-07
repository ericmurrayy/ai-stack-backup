/**
 * Work Order Templates Service
 * ============================
 * Pre-defined templates for common service jobs
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export interface WorkOrderTask {
  id: string;
  name: string;
  description?: string;
  estimated_minutes?: number;
  is_required: boolean;
  order: number;
}

export interface WorkOrderMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_cost?: number;
  notes?: string;
}

export interface WorkOrderTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  estimated_duration: number; // minutes
  base_price?: number;
  tasks: WorkOrderTask[];
  materials: WorkOrderMaterial[];
  notes?: string;
  instructions?: string;
  safety_checklist?: string[];
  tools_required?: string[];
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WorkOrder {
  id: string;
  work_order_number: string;
  job_id?: string;
  customer_id?: string;
  template_id?: string;

  // Details
  title: string;
  description?: string;
  category: string;

  // Tasks and materials
  tasks: (WorkOrderTask & { completed: boolean; completed_at?: string })[];
  materials: (WorkOrderMaterial & { used_quantity?: number })[];

  // Time tracking
  estimated_duration: number;
  actual_duration?: number;
  started_at?: string;
  completed_at?: string;

  // Assignment
  assigned_to?: string;
  assigned_to_name?: string;

  // Pricing
  labor_cost?: number;
  materials_cost?: number;
  total_cost?: number;

  // Notes
  technician_notes?: string;
  customer_signature?: string;
  photos?: string[];

  status: 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
}

// Pre-defined work order templates
export const defaultWorkOrderTemplates: WorkOrderTemplate[] = [
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
      { id: 't8', name: 'Check air filter', description: 'Replace if needed', is_required: true, order: 8 },
      { id: 't9', name: 'Test system operation', is_required: true, order: 9 },
    ],
    materials: [
      { id: 'm1', name: 'Air Filter (standard)', quantity: 1, unit: 'each', unit_cost: 15 },
      { id: 'm2', name: 'Lubricant', quantity: 1, unit: 'can', unit_cost: 8 },
    ],
    safety_checklist: [
      'Turn off power before inspection',
      'Wear safety glasses',
      'Use proper lifting techniques',
    ],
    tools_required: ['Multimeter', 'Refrigerant gauges', 'Fin comb', 'Vacuum/blower'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'ac-install',
    name: 'AC Unit Installation',
    category: 'hvac_install',
    description: 'New air conditioning unit installation',
    estimated_duration: 480, // 8 hours
    base_price: 2999,
    tasks: [
      { id: 't1', name: 'Site assessment', is_required: true, order: 1 },
      { id: 't2', name: 'Remove old unit (if applicable)', is_required: false, order: 2 },
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
      { id: 'm4', name: 'Disconnect box', quantity: 1, unit: 'each', unit_cost: 25 },
    ],
    safety_checklist: [
      'Verify electrical is off at breaker',
      'Wear safety glasses and gloves',
      'Use proper refrigerant handling procedures',
      'Follow ladder safety protocols',
    ],
    tools_required: ['Refrigerant gauges', 'Vacuum pump', 'Torque wrench', 'Flare tools', 'Multimeter'],
    is_active: true,
    created_at: new Date().toISOString(),
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
      { id: 't3', name: 'Camera inspection (if needed)', is_required: false, order: 3 },
      { id: 't4', name: 'Flush drain with water', is_required: true, order: 4 },
      { id: 't5', name: 'Test drainage speed', is_required: true, order: 5 },
      { id: 't6', name: 'Provide recommendations', is_required: true, order: 6 },
    ],
    materials: [],
    safety_checklist: [
      'Wear gloves and eye protection',
      'Ensure proper ventilation',
      'Avoid splashing',
    ],
    tools_required: ['Drain snake/auger', 'Drain camera', 'Plunger', 'Bucket'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'water-heater-install',
    name: 'Water Heater Installation',
    category: 'plumbing_install',
    description: 'Water heater replacement or new installation',
    estimated_duration: 240, // 4 hours
    base_price: 899,
    tasks: [
      { id: 't1', name: 'Shut off water and gas/electric', is_required: true, order: 1 },
      { id: 't2', name: 'Drain old water heater', is_required: true, order: 2 },
      { id: 't3', name: 'Disconnect and remove old unit', is_required: true, order: 3 },
      { id: 't4', name: 'Position new water heater', is_required: true, order: 4 },
      { id: 't5', name: 'Connect water lines', is_required: true, order: 5 },
      { id: 't6', name: 'Connect gas/electric', is_required: true, order: 6 },
      { id: 't7', name: 'Install expansion tank (if needed)', is_required: false, order: 7 },
      { id: 't8', name: 'Fill and check for leaks', is_required: true, order: 8 },
      { id: 't9', name: 'Set temperature and test', is_required: true, order: 9 },
      { id: 't10', name: 'Customer walkthrough', is_required: true, order: 10 },
    ],
    materials: [
      { id: 'm1', name: 'Flexible water connectors', quantity: 2, unit: 'each', unit_cost: 15 },
      { id: 'm2', name: 'Gas flex connector', quantity: 1, unit: 'each', unit_cost: 25 },
      { id: 'm3', name: 'Teflon tape', quantity: 1, unit: 'roll', unit_cost: 3 },
      { id: 'm4', name: 'Pipe dope', quantity: 1, unit: 'tube', unit_cost: 5 },
    ],
    safety_checklist: [
      'Verify gas is off at main',
      'Verify water is off at main',
      'Check for gas leaks with soapy water',
      'Use proper lifting techniques',
    ],
    tools_required: ['Pipe wrenches', 'Channel locks', 'Tubing cutter', 'Level', 'Multimeter'],
    is_active: true,
    created_at: new Date().toISOString(),
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
      { id: 't7', name: 'Check grounding', is_required: true, order: 7 },
      { id: 't8', name: 'Thermal imaging (if available)', is_required: false, order: 8 },
      { id: 't9', name: 'Provide written report', is_required: true, order: 9 },
    ],
    materials: [],
    safety_checklist: [
      'Wear insulated gloves',
      'Use insulated tools only',
      'Never work on live circuits',
      'Use proper lockout/tagout procedures',
    ],
    tools_required: ['Multimeter', 'Voltage tester', 'Thermal camera', 'Insulated screwdrivers'],
    is_active: true,
    created_at: new Date().toISOString(),
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
      { id: 't5', name: 'Install outlet box', is_required: true, order: 5 },
      { id: 't6', name: 'Connect wiring', is_required: true, order: 6 },
      { id: 't7', name: 'Install outlet and cover', is_required: true, order: 7 },
      { id: 't8', name: 'Test outlet', is_required: true, order: 8 },
    ],
    materials: [
      { id: 'm1', name: 'Outlet', quantity: 1, unit: 'each', unit_cost: 5 },
      { id: 'm2', name: 'Outlet box', quantity: 1, unit: 'each', unit_cost: 3 },
      { id: 'm3', name: 'Cover plate', quantity: 1, unit: 'each', unit_cost: 2 },
      { id: 'm4', name: '14/2 Wire', quantity: 25, unit: 'ft', unit_cost: 0.5 },
    ],
    safety_checklist: [
      'Verify power is off with tester',
      'Use insulated tools',
      'Follow local electrical codes',
    ],
    tools_required: ['Voltage tester', 'Wire strippers', 'Drill', 'Fish tape'],
    is_active: true,
    created_at: new Date().toISOString(),
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
      { id: 't6', name: 'Create written estimate', is_required: true, order: 6 },
    ],
    materials: [],
    safety_checklist: ['Follow equipment-specific safety procedures'],
    tools_required: ['Multimeter', 'Diagnostic tools', 'Flashlight'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const workOrdersService = {
  /**
   * Generate unique work order number
   */
  generateWorkOrderNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `WO-${year}-${random}`;
  },

  /**
   * Get all templates
   */
  getTemplates(): WorkOrderTemplate[] {
    return defaultWorkOrderTemplates.filter(t => t.is_active);
  },

  /**
   * Get template by ID
   */
  getTemplateById(templateId: string): WorkOrderTemplate | undefined {
    return defaultWorkOrderTemplates.find(t => t.id === templateId);
  },

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): WorkOrderTemplate[] {
    return defaultWorkOrderTemplates.filter(t => t.category === category && t.is_active);
  },

  /**
   * Create work order from template
   */
  async createFromTemplate(
    templateId: string,
    jobId?: string,
    customerId?: string,
    assignedTo?: string,
    assignedToName?: string
  ): Promise<{ success: boolean; workOrderId?: string; workOrderNumber?: string; error?: string }> {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const workOrderNumber = this.generateWorkOrderNumber();

    const workOrder: Partial<WorkOrder> = {
      work_order_number: workOrderNumber,
      job_id: jobId,
      customer_id: customerId,
      template_id: templateId,
      title: template.name,
      description: template.description,
      category: template.category,
      tasks: template.tasks.map(t => ({ ...t, completed: false })),
      materials: template.materials.map(m => ({ ...m, used_quantity: 0 })),
      estimated_duration: template.estimated_duration,
      assigned_to: assignedTo,
      assigned_to_name: assignedToName,
      labor_cost: template.base_price,
      materials_cost: template.materials.reduce((sum, m) => sum + (m.unit_cost || 0) * m.quantity, 0),
      status: assignedTo ? 'assigned' : 'draft',
      created_at: new Date().toISOString(),
    };

    workOrder.total_cost = (workOrder.labor_cost || 0) + (workOrder.materials_cost || 0);

    const { data, error } = await supabase
      .from('work_orders')
      .insert(workOrder)
      .select('id')
      .single();

    if (error) {
      console.error('[WorkOrders] Create error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, workOrderId: data.id, workOrderNumber };
  },

  /**
   * Create custom work order
   */
  async create(workOrder: Partial<WorkOrder>): Promise<{ success: boolean; workOrderId?: string; workOrderNumber?: string; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const workOrderNumber = this.generateWorkOrderNumber();

    const { data, error } = await supabase
      .from('work_orders')
      .insert({
        ...workOrder,
        work_order_number: workOrderNumber,
        tasks: workOrder.tasks || [],
        materials: workOrder.materials || [],
        status: workOrder.status || 'draft',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[WorkOrders] Create error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, workOrderId: data.id, workOrderNumber };
  },

  /**
   * Get work order by ID
   */
  async getById(id: string): Promise<WorkOrder | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[WorkOrders] Get error:', error);
      return null;
    }

    return data;
  },

  /**
   * Get work orders for a job
   */
  async getByJobId(jobId: string): Promise<WorkOrder[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[WorkOrders] Query error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Update work order
   */
  async update(id: string, updates: Partial<WorkOrder>): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
      .from('work_orders')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[WorkOrders] Update error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Mark task as completed
   */
  async completeTask(workOrderId: string, taskId: string): Promise<{ success: boolean; error?: string }> {
    const workOrder = await this.getById(workOrderId);
    if (!workOrder) {
      return { success: false, error: 'Work order not found' };
    }

    const updatedTasks = workOrder.tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, completed: true, completed_at: new Date().toISOString() };
      }
      return task;
    });

    return this.update(workOrderId, { tasks: updatedTasks });
  },

  /**
   * Start work order
   */
  async start(id: string): Promise<{ success: boolean; error?: string }> {
    return this.update(id, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });
  },

  /**
   * Complete work order
   */
  async complete(
    id: string,
    technicianNotes?: string,
    actualDuration?: number
  ): Promise<{ success: boolean; error?: string }> {
    return this.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      technician_notes: technicianNotes,
      actual_duration: actualDuration,
    });
  },

  /**
   * Get work order statistics
   */
  async getStats(): Promise<{
    total: number;
    draft: number;
    assigned: number;
    in_progress: number;
    completed: number;
    avgCompletionTime: number;
  }> {
    if (!supabase) {
      return { total: 0, draft: 0, assigned: 0, in_progress: 0, completed: 0, avgCompletionTime: 0 };
    }

    const { data } = await supabase
      .from('work_orders')
      .select('status, actual_duration');

    if (!data) {
      return { total: 0, draft: 0, assigned: 0, in_progress: 0, completed: 0, avgCompletionTime: 0 };
    }

    const completed = data.filter(wo => wo.status === 'completed');
    const avgCompletionTime = completed.length > 0
      ? completed.reduce((sum, wo) => sum + (wo.actual_duration || 0), 0) / completed.length
      : 0;

    return {
      total: data.length,
      draft: data.filter(wo => wo.status === 'draft').length,
      assigned: data.filter(wo => wo.status === 'assigned').length,
      in_progress: data.filter(wo => wo.status === 'in_progress').length,
      completed: completed.length,
      avgCompletionTime: Math.round(avgCompletionTime),
    };
  },
};

export default workOrdersService;
