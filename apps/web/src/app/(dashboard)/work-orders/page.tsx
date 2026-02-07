'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ClipboardList,
  Plus,
  Clock,
  User,
  DollarSign,
  CheckCircle,
  Circle,
  Play,
  Check,
  Search,
  Filter,
  Eye,
  X,
  Wrench,
  Zap,
  Droplet,
  Package,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface Task {
  id: string;
  name: string;
  description?: string;
  is_required: boolean;
  order: number;
  completed?: boolean;
  completed_at?: string;
}

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_cost?: number;
  used_quantity?: number;
}

interface WorkOrder {
  id: string;
  work_order_number: string;
  job_id?: string;
  template_id?: string;
  title: string;
  description?: string;
  category: string;
  tasks: Task[];
  materials: Material[];
  estimated_duration: number;
  actual_duration?: number;
  started_at?: string;
  completed_at?: string;
  assigned_to_name?: string;
  labor_cost?: number;
  materials_cost?: number;
  total_cost?: number;
  technician_notes?: string;
  status: 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

interface WorkOrderTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  estimated_duration: number;
  base_price: number;
  tasks: Task[];
  materials: Material[];
}

interface Stats {
  total: number;
  draft: number;
  assigned: number;
  in_progress: number;
  completed: number;
}

const statusConfig = {
  draft: { label: 'Draft', color: 'default', icon: ClipboardList },
  assigned: { label: 'Assigned', color: 'info', icon: User },
  in_progress: { label: 'In Progress', color: 'warning', icon: Play },
  completed: { label: 'Completed', color: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'error', icon: X },
} as const;

const categoryIcons: Record<string, React.ElementType> = {
  hvac_maintenance: Zap,
  hvac_install: Zap,
  plumbing_service: Droplet,
  plumbing_install: Droplet,
  electrical_service: Zap,
  electrical_install: Zap,
  diagnostic: Wrench,
};

const categoryLabels: Record<string, string> = {
  hvac_maintenance: 'HVAC Maintenance',
  hvac_install: 'HVAC Installation',
  plumbing_service: 'Plumbing Service',
  plumbing_install: 'Plumbing Installation',
  electrical_service: 'Electrical Service',
  electrical_install: 'Electrical Installation',
  diagnostic: 'Diagnostic',
};

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [workOrdersRes, templatesRes] = await Promise.all([
        fetch('/api/work-orders'),
        fetch('/api/work-orders?templates=true'),
      ]);

      if (workOrdersRes.ok) {
        const data = await workOrdersRes.json();
        setWorkOrders(data.workOrders || []);
        setStats(data.stats);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch work orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesFilter = filter === 'all' || wo.status === filter;
    const matchesSearch = !searchQuery ||
      wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.work_order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.assigned_to_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getCompletionPercentage = (tasks: Task[]) => {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  };

  async function handleStatusChange(workOrderId: string, newStatus: string) {
    try {
      const updates: any = { id: workOrderId, status: newStatus };
      if (newStatus === 'in_progress') {
        updates.started_at = new Date().toISOString();
      }
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      await fetch('/api/work-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to update work order:', error);
    }
  }

  async function handleTaskToggle(workOrderId: string, taskId: string, currentStatus: boolean) {
    const workOrder = workOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;

    const updatedTasks = workOrder.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          completed: !currentStatus,
          completed_at: !currentStatus ? new Date().toISOString() : undefined,
        };
      }
      return task;
    });

    try {
      await fetch('/api/work-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workOrderId, tasks: updatedTasks }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }

  async function createWorkOrderFromTemplate(template: WorkOrderTemplate) {
    try {
      const materialsCost = template.materials.reduce(
        (sum, m) => sum + (m.unit_cost || 0) * m.quantity,
        0
      );

      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          title: template.name,
          description: template.description,
          category: template.category,
          tasks: template.tasks.map(t => ({ ...t, completed: false })),
          materials: template.materials.map(m => ({ ...m, used_quantity: 0 })),
          estimated_duration: template.estimated_duration,
          labor_cost: template.base_price,
          materials_cost: materialsCost,
          total_cost: template.base_price + materialsCost,
          status: 'draft',
        }),
      });

      if (response.ok) {
        setShowNewModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to create work order:', error);
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Work Orders" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-16 bg-gray-200 rounded" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Work Orders" />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.total || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <ClipboardList className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Draft</p>
                <p className="text-2xl font-bold text-slate-600">{stats?.draft || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Assigned</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.assigned || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Play className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.in_progress || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search work orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Work Order
          </Button>
        </div>

        {/* Work Orders List */}
        <div className="space-y-4">
          {filteredWorkOrders.map((wo) => {
            const statusInfo = statusConfig[wo.status];
            const CategoryIcon = categoryIcons[wo.category] || Wrench;
            const completionPct = getCompletionPercentage(wo.tasks);
            const isExpanded = expandedTasks === wo.id;

            return (
              <Card key={wo.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Work Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CategoryIcon className="w-5 h-5 text-slate-400" />
                      <h3 className="font-semibold text-slate-900">{wo.title}</h3>
                      <Badge variant={statusInfo.color as any}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-4 h-4" />
                        {wo.work_order_number}
                      </span>
                      {wo.assigned_to_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {wo.assigned_to_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(wo.estimated_duration)}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                        {categoryLabels[wo.category] || wo.category}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {wo.tasks && wo.tasks.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>
                            {wo.tasks.filter(t => t.completed).length} / {wo.tasks.length} tasks
                          </span>
                          <span>{completionPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Expandable Tasks */}
                    <button
                      onClick={() => setExpandedTasks(isExpanded ? null : wo.id)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Hide Tasks
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-4 h-4" />
                          Show Tasks ({wo.tasks?.length || 0})
                        </>
                      )}
                    </button>

                    {isExpanded && wo.tasks && (
                      <div className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200">
                        {wo.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <button
                              onClick={() => handleTaskToggle(wo.id, task.id, task.completed || false)}
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                task.completed
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-slate-300 hover:border-blue-500'
                              }`}
                            >
                              {task.completed && <Check className="w-3 h-3" />}
                            </button>
                            <span className={task.completed ? 'line-through text-slate-400' : ''}>
                              {task.name}
                            </span>
                            {task.is_required && (
                              <span className="text-xs text-red-500">*</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Value and Actions */}
                  <div className="flex items-center gap-4">
                    {wo.total_cost && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {formatCurrency(wo.total_cost)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Labor: {formatCurrency(wo.labor_cost || 0)}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      {wo.status === 'draft' && (
                        <Button
                          variant="secondary"
                          onClick={() => handleStatusChange(wo.id, 'assigned')}
                        >
                          Assign
                        </Button>
                      )}
                      {wo.status === 'assigned' && (
                        <Button onClick={() => handleStatusChange(wo.id, 'in_progress')}>
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                      {wo.status === 'in_progress' && (
                        <Button
                          onClick={() => handleStatusChange(wo.id, 'completed')}
                          disabled={wo.tasks?.some(t => t.is_required && !t.completed)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedWorkOrder(wo);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {filteredWorkOrders.length === 0 && (
            <Card className="p-8 text-center">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Work Orders Found</h3>
              <p className="text-slate-500 mb-4">
                {searchQuery || filter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create a work order from a template to get started'}
              </p>
              {!searchQuery && filter === 'all' && (
                <Button onClick={() => setShowNewModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Work Order
                </Button>
              )}
            </Card>
          )}
        </div>

        {/* New Work Order Modal */}
        {showNewModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Create Work Order</h2>
                  <button
                    onClick={() => setShowNewModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-slate-600 mb-4">Select a template to create a work order:</p>

                <div className="grid gap-4">
                  {templates.map((template) => {
                    const CategoryIcon = categoryIcons[template.category] || Wrench;
                    return (
                      <div
                        key={template.id}
                        onClick={() => createWorkOrderFromTemplate(template)}
                        className="p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <CategoryIcon className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900">{template.name}</h3>
                              <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                <span>{template.tasks.length} tasks</span>
                                <span>{template.materials.length} materials</span>
                                <span>{formatDuration(template.estimated_duration)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-900">
                              {formatCurrency(template.base_price)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {categoryLabels[template.category]}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Work Order Detail Modal */}
        {showDetailModal && selectedWorkOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedWorkOrder.title}</h2>
                    <p className="text-sm text-slate-500">{selectedWorkOrder.work_order_number}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedWorkOrder(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Status</p>
                      <Badge variant={statusConfig[selectedWorkOrder.status].color as any}>
                        {statusConfig[selectedWorkOrder.status].label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Category</p>
                      <p className="font-medium">{categoryLabels[selectedWorkOrder.category]}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Estimated Duration</p>
                      <p className="font-medium">{formatDuration(selectedWorkOrder.estimated_duration)}</p>
                    </div>
                    {selectedWorkOrder.assigned_to_name && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase">Assigned To</p>
                        <p className="font-medium">{selectedWorkOrder.assigned_to_name}</p>
                      </div>
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Tasks</p>
                    <div className="space-y-2">
                      {selectedWorkOrder.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded"
                        >
                          {task.completed ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300" />
                          )}
                          <span className={task.completed ? 'line-through text-slate-400' : ''}>
                            {task.name}
                          </span>
                          {task.is_required && !task.completed && (
                            <span className="text-xs text-red-500 ml-auto">Required</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Materials */}
                  {selectedWorkOrder.materials && selectedWorkOrder.materials.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-xs text-slate-500 uppercase mb-2">Materials</p>
                      <div className="space-y-2">
                        {selectedWorkOrder.materials.map((material) => (
                          <div
                            key={material.id}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded"
                          >
                            <span>{material.name}</span>
                            <span className="text-sm text-slate-500">
                              {material.quantity} {material.unit}
                              {material.unit_cost && ` @ ${formatCurrency(material.unit_cost)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Pricing</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Labor</span>
                        <span>{formatCurrency(selectedWorkOrder.labor_cost || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Materials</span>
                        <span>{formatCurrency(selectedWorkOrder.materials_cost || 0)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Total</span>
                        <span>{formatCurrency(selectedWorkOrder.total_cost || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedWorkOrder(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
