'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Receipt,
  Plus,
  DollarSign,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  Upload,
  FileText,
  Truck,
  Wrench,
  Building2,
  Users,
  Fuel,
} from 'lucide-react';

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor?: string;
  job_id?: string;
  job_number?: string;
  receipt_url?: string;
  created_at: string;
  created_by?: string;
}

interface ExpenseStats {
  totalThisMonth: number;
  totalLastMonth: number;
  byCategory: { category: string; amount: number }[];
}

const categories = [
  { value: 'parts', label: 'Parts & Materials', icon: Wrench },
  { value: 'fuel', label: 'Fuel', icon: Fuel },
  { value: 'vehicle', label: 'Vehicle Maintenance', icon: Truck },
  { value: 'tools', label: 'Tools & Equipment', icon: Wrench },
  { value: 'office', label: 'Office Supplies', icon: Building2 },
  { value: 'labor', label: 'Subcontractor/Labor', icon: Users },
  { value: 'other', label: 'Other', icon: Receipt },
];

const categoryColors: Record<string, string> = {
  parts: 'bg-blue-100 text-blue-800',
  fuel: 'bg-yellow-100 text-yellow-800',
  vehicle: 'bg-purple-100 text-purple-800',
  tools: 'bg-orange-100 text-orange-800',
  office: 'bg-gray-100 text-gray-800',
  labor: 'bg-green-100 text-green-800',
  other: 'bg-slate-100 text-slate-800',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'parts',
    description: '',
    amount: '',
    vendor: '',
    job_id: '',
  });

  const fetchExpenses = async () => {
    try {
      const response = await fetch('/api/expenses');
      const data = await response.json();
      setExpenses(data.expenses || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      // Mock data for demo
      setExpenses([
        {
          id: '1',
          date: '2026-02-01',
          category: 'parts',
          description: 'AC Compressor for Johnson repair',
          amount: 245.99,
          vendor: 'HVAC Supply Co',
          job_id: 'job-123',
          job_number: 'JOB-001',
          created_at: '2026-02-01T10:00:00Z',
        },
        {
          id: '2',
          date: '2026-02-01',
          category: 'fuel',
          description: 'Service vehicle fill-up',
          amount: 68.50,
          vendor: 'Shell Gas Station',
          created_at: '2026-02-01T08:30:00Z',
        },
        {
          id: '3',
          date: '2026-01-31',
          category: 'tools',
          description: 'Multimeter replacement',
          amount: 89.00,
          vendor: 'Home Depot',
          created_at: '2026-01-31T14:00:00Z',
        },
      ]);
      setStats({
        totalThisMonth: 1245.67,
        totalLastMonth: 1876.43,
        byCategory: [
          { category: 'parts', amount: 567.89 },
          { category: 'fuel', amount: 342.50 },
          { category: 'tools', amount: 189.00 },
          { category: 'vehicle', amount: 146.28 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount),
        }),
      });

      if (response.ok) {
        setShowAddDialog(false);
        setNewExpense({
          date: new Date().toISOString().split('T')[0],
          category: 'parts',
          description: '',
          amount: '',
          vendor: '',
          job_id: '',
        });
        fetchExpenses();
      }
    } catch (error) {
      console.error('Failed to add expense:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.vendor?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Track and manage business expenses
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats?.totalThisMonth || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Month</CardTitle>
            <Calendar className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalLastMonth || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Previous period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Change</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (stats?.totalThisMonth || 0) < (stats?.totalLastMonth || 0)
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {stats?.totalLastMonth
                ? `${(((stats.totalThisMonth - stats.totalLastMonth) / stats.totalLastMonth) * 100).toFixed(1)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
            <Receipt className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {stats?.byCategory?.[0]?.category || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.byCategory?.[0]
                ? formatCurrency(stats.byCategory[0].amount)
                : 'No expenses'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {stats?.byCategory && stats.byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byCategory.map((cat) => {
                const percentage = stats.totalThisMonth
                  ? (cat.amount / stats.totalThisMonth) * 100
                  : 0;
                const CategoryIcon = categories.find(c => c.value === cat.category)?.icon || Receipt;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <CategoryIcon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{cat.category}</span>
                        <span>{formatCurrency(cat.amount)}</span>
                      </div>
                      <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      <Card>
        <CardHeader>
          <CardTitle>
            All Expenses
            {filteredExpenses.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredExpenses.length} items, {formatCurrency(totalFiltered)} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No expenses found</h3>
              <p className="text-muted-foreground">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Start tracking expenses by adding your first one'}
              </p>
              {!searchQuery && categoryFilter === 'all' && (
                <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell>
                      <Badge className={categoryColors[expense.category]}>
                        {expense.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {expense.description}
                    </TableCell>
                    <TableCell>{expense.vendor || '-'}</TableCell>
                    <TableCell>
                      {expense.job_number ? (
                        <span className="text-blue-600">#{expense.job_number}</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Track a new business expense
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={newExpense.category}
                  onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                placeholder="What was this expense for?"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-9"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Vendor</label>
                <Input
                  placeholder="Where was this purchased?"
                  value={newExpense.vendor}
                  onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddExpense}
              disabled={submitting || !newExpense.description || !newExpense.amount}
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
