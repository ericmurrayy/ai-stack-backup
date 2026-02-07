'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  FileText,
  Plus,
  Calendar,
  DollarSign,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
  Search,
  Eye,
  Edit,
  Send,
  RotateCcw,
  X,
  Check,
  Sparkles,
} from 'lucide-react';

interface ContractService {
  id: string;
  name: string;
  frequency: string;
  included_visits?: number;
}

interface Contract {
  id: string;
  contract_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  name: string;
  description?: string;
  status: 'draft' | 'pending' | 'active' | 'expired' | 'cancelled';
  start_date: string;
  end_date: string;
  signed_date?: string;
  billing_frequency: string;
  contract_value: number;
  monthly_rate?: number;
  auto_renew: boolean;
  services: ContractService[];
  visits_used: number;
  last_service_date?: string;
  next_service_date?: string;
  created_at: string;
}

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  billing_frequency: string;
  duration_months: number;
  base_price: number;
  services: ContractService[];
  benefits: string[];
  terms_summary: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  expired: number;
  cancelled: number;
  totalValue: number;
  monthlyRecurring: number;
}

const statusConfig = {
  draft: { label: 'Draft', color: 'default', icon: FileText },
  pending: { label: 'Pending Signature', color: 'warning', icon: Clock },
  active: { label: 'Active', color: 'success', icon: CheckCircle },
  expired: { label: 'Expired', color: 'error', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'default', icon: X },
} as const;

const frequencyLabels: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semi-Annual',
  annual: 'Annual',
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [contractsRes, templatesRes] = await Promise.all([
        fetch('/api/contracts'),
        fetch('/api/contracts/templates'),
      ]);

      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setContracts(data.contracts || []);
        setStats(data.stats);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredContracts = contracts.filter(contract => {
    const matchesFilter = filter === 'all' || contract.status === filter;
    const matchesSearch = !searchQuery ||
      contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getDaysRemaining = (endDate: string) => {
    const days = Math.ceil(
      (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  async function handleStatusChange(contractId: string, newStatus: string) {
    try {
      await fetch('/api/contracts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contractId, status: newStatus }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to update contract:', error);
    }
  }

  async function handleRenew(contractId: string) {
    try {
      // In a real app, this would create a new contract based on the old one
      alert('Renewal functionality would create a new contract');
      fetchData();
    } catch (error) {
      console.error('Failed to renew contract:', error);
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Service Contracts" />
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
      <Header title="Service Contracts" />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Contracts</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.total || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats?.active || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Contract Value</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(stats?.totalValue || 0)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Monthly Recurring</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(stats?.monthlyRecurring || 0)}
                </p>
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
                placeholder="Search contracts..."
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
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Contract
          </Button>
        </div>

        {/* Contracts List */}
        <div className="space-y-4">
          {filteredContracts.map((contract) => {
            const statusInfo = statusConfig[contract.status];
            const daysRemaining = getDaysRemaining(contract.end_date);
            const isExpiringSoon = contract.status === 'active' && daysRemaining <= 30 && daysRemaining > 0;

            return (
              <Card key={contract.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Contract Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{contract.name}</h3>
                      <Badge variant={statusInfo.color as any}>
                        {statusInfo.label}
                      </Badge>
                      {isExpiringSoon && (
                        <Badge variant="warning">
                          Expires in {daysRemaining} days
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {contract.customer_name || 'Unknown Customer'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {contract.contract_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                      </span>
                    </div>
                  </div>

                  {/* Value and Actions */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(contract.contract_value)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {frequencyLabels[contract.billing_frequency] || contract.billing_frequency}
                        {contract.monthly_rate && ` (${formatCurrency(contract.monthly_rate)}/mo)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedContract(contract);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {contract.status === 'draft' && (
                        <button
                          onClick={() => handleStatusChange(contract.id, 'pending')}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Send for Signature"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {contract.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(contract.id, 'active')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Mark as Signed"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {(contract.status === 'active' || contract.status === 'expired') && (
                        <button
                          onClick={() => handleRenew(contract.id)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Renew Contract"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Services Summary */}
                {contract.services && contract.services.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      {contract.services.map((service, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                        >
                          {service.name}
                          {service.included_visits && ` (${service.included_visits}x)`}
                        </span>
                      ))}
                    </div>
                    {contract.visits_used > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        {contract.visits_used} visits used
                        {contract.last_service_date && ` • Last service: ${formatDate(contract.last_service_date)}`}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {filteredContracts.length === 0 && (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Contracts Found</h3>
              <p className="text-slate-500 mb-4">
                {searchQuery || filter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first service contract to get started'}
              </p>
              {!searchQuery && filter === 'all' && (
                <Button onClick={() => setShowNewModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Contract
                </Button>
              )}
            </Card>
          )}
        </div>

        {/* New Contract Modal */}
        {showNewModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Create New Contract</h2>
                  <button
                    onClick={() => {
                      setShowNewModal(false);
                      setSelectedTemplate(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!selectedTemplate ? (
                  <div>
                    <p className="text-slate-600 mb-4">Select a contract template to get started:</p>
                    <div className="grid gap-4">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className="p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-slate-900">{template.name}</h3>
                              <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {template.services.slice(0, 3).map((service, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600"
                                  >
                                    {service.name}
                                  </span>
                                ))}
                                {template.services.length > 3 && (
                                  <span className="px-2 py-0.5 text-xs text-slate-500">
                                    +{template.services.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-900">
                                {formatCurrency(template.base_price)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {template.billing_frequency === 'monthly' ? '/month' : '/year'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="text-blue-600 text-sm mb-4 hover:underline"
                    >
                      ← Choose different template
                    </button>

                    <div className="p-4 bg-blue-50 rounded-lg mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-blue-900">{selectedTemplate.name}</h3>
                      </div>
                      <p className="text-sm text-blue-700">{selectedTemplate.description}</p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target as HTMLFormElement);
                        const startDate = formData.get('start_date') as string;
                        const endDate = new Date(startDate);
                        endDate.setMonth(endDate.getMonth() + selectedTemplate.duration_months);

                        try {
                          const response = await fetch('/api/contracts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              customer_id: formData.get('customer_id'),
                              customer_name: formData.get('customer_name'),
                              customer_email: formData.get('customer_email'),
                              name: selectedTemplate.name,
                              description: selectedTemplate.description,
                              status: 'draft',
                              start_date: startDate,
                              end_date: endDate.toISOString().split('T')[0],
                              billing_frequency: selectedTemplate.billing_frequency,
                              contract_value: selectedTemplate.billing_frequency === 'monthly'
                                ? selectedTemplate.base_price * selectedTemplate.duration_months
                                : selectedTemplate.base_price,
                              monthly_rate: selectedTemplate.billing_frequency === 'monthly'
                                ? selectedTemplate.base_price
                                : Math.round(selectedTemplate.base_price / 12 * 100) / 100,
                              auto_renew: true,
                              services: selectedTemplate.services,
                            }),
                          });

                          if (response.ok) {
                            setShowNewModal(false);
                            setSelectedTemplate(null);
                            fetchData();
                          }
                        } catch (error) {
                          console.error('Failed to create contract:', error);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Customer Name *
                          </label>
                          <input
                            type="text"
                            name="customer_name"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            placeholder="John Smith"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Customer Email
                          </label>
                          <input
                            type="email"
                            name="customer_email"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Start Date *
                          </label>
                          <input
                            type="date"
                            name="start_date"
                            required
                            defaultValue={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Duration
                          </label>
                          <input
                            type="text"
                            value={`${selectedTemplate.duration_months} months`}
                            disabled
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                          />
                        </div>
                      </div>

                      <input type="hidden" name="customer_id" value={`cust-${Date.now()}`} />

                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium text-slate-900 mb-2">Included Services:</h4>
                        <ul className="space-y-1">
                          {selectedTemplate.services.map((service, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                              <Check className="w-4 h-4 text-green-500" />
                              {service.name}
                              {service.included_visits && (
                                <span className="text-slate-400">
                                  ({service.included_visits} visits/{service.frequency})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {selectedTemplate.benefits && (
                        <div className="border-t pt-4">
                          <h4 className="font-medium text-slate-900 mb-2">Benefits:</h4>
                          <ul className="grid grid-cols-2 gap-1">
                            {selectedTemplate.benefits.map((benefit, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                <Sparkles className="w-3 h-3 text-yellow-500" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t">
                        <div>
                          <p className="text-2xl font-bold text-slate-900">
                            {formatCurrency(selectedTemplate.base_price)}
                            <span className="text-sm font-normal text-slate-500 ml-1">
                              {selectedTemplate.billing_frequency === 'monthly' ? '/month' : '/year'}
                            </span>
                          </p>
                          {selectedTemplate.billing_frequency !== 'monthly' && (
                            <p className="text-sm text-slate-500">
                              ~{formatCurrency(selectedTemplate.base_price / 12)}/month
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setShowNewModal(false);
                              setSelectedTemplate(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">
                            Create Contract
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Contract Detail Modal */}
        {showDetailModal && selectedContract && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedContract.name}</h2>
                    <p className="text-sm text-slate-500">{selectedContract.contract_number}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedContract(null);
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
                      <Badge variant={statusConfig[selectedContract.status].color as any}>
                        {statusConfig[selectedContract.status].label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Auto-Renew</p>
                      <p className="font-medium">{selectedContract.auto_renew ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Customer</p>
                      <p className="font-medium">{selectedContract.customer_name}</p>
                      {selectedContract.customer_email && (
                        <p className="text-sm text-slate-500">{selectedContract.customer_email}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Contract Period</p>
                      <p className="font-medium">
                        {formatDate(selectedContract.start_date)} - {formatDate(selectedContract.end_date)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Contract Value</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedContract.contract_value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Billing</p>
                      <p className="font-medium">
                        {frequencyLabels[selectedContract.billing_frequency]}
                        {selectedContract.monthly_rate && (
                          <span className="text-slate-500 text-sm">
                            {' '}({formatCurrency(selectedContract.monthly_rate)}/mo)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedContract.services && selectedContract.services.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-xs text-slate-500 uppercase mb-2">Included Services</p>
                      <div className="space-y-2">
                        {selectedContract.services.map((service, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded"
                          >
                            <span className="font-medium">{service.name}</span>
                            <span className="text-sm text-slate-500">
                              {service.included_visits}x / {service.frequency}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Service Usage</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold">{selectedContract.visits_used}</p>
                        <p className="text-xs text-slate-500">Visits Used</p>
                      </div>
                      {selectedContract.last_service_date && (
                        <div>
                          <p className="font-medium">{formatDate(selectedContract.last_service_date)}</p>
                          <p className="text-xs text-slate-500">Last Service</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedContract(null);
                    }}
                  >
                    Close
                  </Button>
                  {selectedContract.status === 'active' && (
                    <Button onClick={() => handleRenew(selectedContract.id)}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Renew Contract
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
