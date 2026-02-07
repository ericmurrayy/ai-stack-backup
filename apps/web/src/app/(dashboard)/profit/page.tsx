'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Wrench,
  Calculator,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
  PieChart,
  BarChart3,
} from 'lucide-react';

interface ProfitData {
  period: string;
  revenue: number;
  expenses: number;
  laborCost: number;
  materialsCost: number;
  overhead: number;
  netProfit: number;
  profitMargin: number;
  jobsCompleted: number;
  avgJobProfit: number;
}

interface CategoryBreakdown {
  category: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  jobs: number;
}

interface TrendData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function ProfitDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  useEffect(() => {
    fetchProfitData();
  }, [period]);

  async function fetchProfitData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/profit?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setProfitData(data.summary);
        setCategoryBreakdown(data.categoryBreakdown || []);
        setTrendData(data.trend || []);
      }
    } catch (error) {
      console.error('Failed to fetch profit data:', error);
      // Set mock data for demo
      setProfitData({
        period: period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : 'This Year',
        revenue: 45750,
        expenses: 18250,
        laborCost: 12500,
        materialsCost: 8750,
        overhead: 4500,
        netProfit: 20000,
        profitMargin: 43.7,
        jobsCompleted: 42,
        avgJobProfit: 476,
      });
      setCategoryBreakdown([
        { category: 'HVAC', revenue: 18500, cost: 7200, profit: 11300, margin: 61, jobs: 12 },
        { category: 'Plumbing', revenue: 12800, cost: 5600, profit: 7200, margin: 56, jobs: 15 },
        { category: 'Electrical', revenue: 9450, cost: 4100, profit: 5350, margin: 57, jobs: 8 },
        { category: 'General', revenue: 5000, cost: 1350, profit: 3650, margin: 73, jobs: 7 },
      ]);
      setTrendData([
        { month: 'Sep', revenue: 38000, expenses: 16000, profit: 22000 },
        { month: 'Oct', revenue: 42500, expenses: 17500, profit: 25000 },
        { month: 'Nov', revenue: 39000, expenses: 15800, profit: 23200 },
        { month: 'Dec', revenue: 35000, expenses: 14200, profit: 20800 },
        { month: 'Jan', revenue: 41000, expenses: 16800, profit: 24200 },
        { month: 'Feb', revenue: 45750, expenses: 18250, profit: 27500 },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getProfitColor = (margin: number) => {
    if (margin >= 50) return 'text-green-600';
    if (margin >= 30) return 'text-blue-600';
    if (margin >= 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <div>
        <Header title="Profit & Loss" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-20 bg-gray-200 rounded" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Profit & Loss" />

      <div className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Financial Overview</h2>
            <p className="text-sm text-slate-500">
              {profitData?.period || 'This Month'}
            </p>
          </div>
          <div className="flex gap-2">
            {(['month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === 'month' ? 'This Month' : p === 'quarter' ? 'This Quarter' : 'This Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Revenue</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(profitData?.revenue || 0)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {getChangeIcon(12.5)}
                  <span className="text-sm text-green-600">+12.5% vs last {period}</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Expenses</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(profitData?.expenses || 0)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {getChangeIcon(-5.2)}
                  <span className="text-sm text-green-600">-5.2% vs last {period}</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-red-100">
                <Receipt className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Net Profit</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(profitData?.netProfit || 0)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {getChangeIcon(18.3)}
                  <span className="text-sm text-green-600">+18.3% vs last {period}</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Profit Margin</p>
                <p className={`text-2xl font-bold mt-1 ${getProfitColor(profitData?.profitMargin || 0)}`}>
                  {profitData?.profitMargin.toFixed(1)}%
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-sm text-slate-500">Industry avg: 35%</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <Calculator className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Expense Breakdown & Category Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Breakdown */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Expense Breakdown</h3>
              <PieChart className="w-5 h-5 text-slate-400" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">Labor Costs</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(profitData?.laborCost || 0)}</p>
                  <p className="text-xs text-slate-500">
                    {((profitData?.laborCost || 0) / (profitData?.expenses || 1) * 100).toFixed(0)}% of expenses
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Materials & Parts</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(profitData?.materialsCost || 0)}</p>
                  <p className="text-xs text-slate-500">
                    {((profitData?.materialsCost || 0) / (profitData?.expenses || 1) * 100).toFixed(0)}% of expenses
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium">Overhead</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(profitData?.overhead || 0)}</p>
                  <p className="text-xs text-slate-500">
                    {((profitData?.overhead || 0) / (profitData?.expenses || 1) * 100).toFixed(0)}% of expenses
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="mt-6">
              <div className="flex h-4 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500"
                  style={{ width: `${((profitData?.laborCost || 0) / (profitData?.expenses || 1) * 100)}%` }}
                />
                <div
                  className="bg-green-500"
                  style={{ width: `${((profitData?.materialsCost || 0) / (profitData?.expenses || 1) * 100)}%` }}
                />
                <div
                  className="bg-yellow-500"
                  style={{ width: `${((profitData?.overhead || 0) / (profitData?.expenses || 1) * 100)}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Category Performance */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Profitability by Category</h3>
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </div>

            <div className="space-y-4">
              {categoryBreakdown.map((cat) => (
                <div key={cat.category} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{cat.category}</span>
                      <Badge variant="default">{cat.jobs} jobs</Badge>
                    </div>
                    <span className={`font-bold ${getProfitColor(cat.margin)}`}>
                      {cat.margin}% margin
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Revenue: {formatCurrency(cat.revenue)}</span>
                    <span>Profit: {formatCurrency(cat.profit)}</span>
                  </div>
                  <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${cat.margin}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 6-Month Trend Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">6-Month Trend</h3>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Profit</span>
              </div>
            </div>
          </div>

          {/* Simple bar chart visualization */}
          <div className="h-64 flex items-end justify-around gap-2">
            {trendData.map((month, index) => {
              const maxValue = Math.max(...trendData.map(m => m.revenue));
              const revenueHeight = (month.revenue / maxValue) * 100;
              const expenseHeight = (month.expenses / maxValue) * 100;
              const profitHeight = (month.profit / maxValue) * 100;

              return (
                <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex gap-1 h-48 items-end">
                    <div
                      className="w-4 bg-green-500 rounded-t transition-all"
                      style={{ height: `${revenueHeight}%` }}
                      title={`Revenue: ${formatCurrency(month.revenue)}`}
                    />
                    <div
                      className="w-4 bg-red-400 rounded-t transition-all"
                      style={{ height: `${expenseHeight}%` }}
                      title={`Expenses: ${formatCurrency(month.expenses)}`}
                    />
                    <div
                      className="w-4 bg-blue-500 rounded-t transition-all"
                      style={{ height: `${profitHeight}%` }}
                      title={`Profit: ${formatCurrency(month.profit)}`}
                    />
                  </div>
                  <span className="text-sm text-slate-600">{month.month}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Job Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <Wrench className="w-8 h-8 text-blue-600 mx-auto mb-3" />
            <p className="text-3xl font-bold text-slate-900">
              {profitData?.jobsCompleted || 0}
            </p>
            <p className="text-sm text-slate-500">Jobs Completed</p>
          </Card>

          <Card className="p-6 text-center">
            <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-3" />
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(profitData?.avgJobProfit || 0)}
            </p>
            <p className="text-sm text-slate-500">Average Profit per Job</p>
          </Card>

          <Card className="p-6 text-center">
            <Calculator className="w-8 h-8 text-purple-600 mx-auto mb-3" />
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency((profitData?.revenue || 0) / (profitData?.jobsCompleted || 1))}
            </p>
            <p className="text-sm text-slate-500">Average Revenue per Job</p>
          </Card>
        </div>

        {/* Quick Insights */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-green-50">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">AI Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Top Performer</span>
              </div>
              <p className="text-sm text-slate-600">
                <strong>HVAC services</strong> are your most profitable category with a 61% margin.
                Consider allocating more marketing budget to this service line.
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Seasonal Trend</span>
              </div>
              <p className="text-sm text-slate-600">
                Revenue is <strong>up 12.5%</strong> compared to last month.
                This aligns with typical seasonal patterns for your industry.
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <Receipt className="w-5 h-5" />
                <span className="font-medium">Cost Optimization</span>
              </div>
              <p className="text-sm text-slate-600">
                Labor costs are <strong>49% of expenses</strong>. Industry benchmark is 45%.
                Consider reviewing scheduling efficiency.
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Calculator className="w-5 h-5" />
                <span className="font-medium">Profit Margin</span>
              </div>
              <p className="text-sm text-slate-600">
                Your <strong>43.7% profit margin</strong> exceeds the industry average of 35%.
                Great job maintaining healthy margins!
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
