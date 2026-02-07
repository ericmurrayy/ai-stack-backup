'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Phone,
  FileText,
  Star
} from 'lucide-react';

interface RevenueData {
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
}

interface CallStats {
  totalCalls: number;
  todayCalls: number;
  avgDuration: number;
  appointmentsBooked: number;
}

interface ReviewStats {
  totalRequests: number;
  sent: number;
  reviewed: number;
  conversionRate: number;
}

export function RevenueStats() {
  const [invoiceStats, setInvoiceStats] = useState<RevenueData | null>(null);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [invoiceRes, phoneRes, reviewRes] = await Promise.all([
          fetch('/api/invoices?action=stats'),
          fetch('/api/phone?action=stats'),
          fetch('/api/reviews?action=stats'),
        ]);

        if (invoiceRes.ok) setInvoiceStats(await invoiceRes.json());
        if (phoneRes.ok) setCallStats(await phoneRes.json());
        if (reviewRes.ok) setReviewStats(await reviewRes.json());
      } catch (error) {
        console.error('Failed to fetch revenue stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-16 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'Revenue This Month',
      value: invoiceStats?.paidThisMonth || 0,
      format: 'currency',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Pending Invoices',
      value: invoiceStats?.pendingAmount || 0,
      format: 'currency',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Overdue Amount',
      value: invoiceStats?.overdueAmount || 0,
      format: 'currency',
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: 'Total Revenue',
      value: invoiceStats?.totalRevenue || 0,
      format: 'currency',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
  ];

  const secondaryStats = [
    {
      title: 'Calls Today',
      value: callStats?.todayCalls || 0,
      subtitle: `${callStats?.appointmentsBooked || 0} jobs booked`,
      icon: Phone,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Review Rate',
      value: reviewStats?.conversionRate || 0,
      format: 'percent',
      subtitle: `${reviewStats?.reviewed || 0} reviews received`,
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  const formatValue = (value: number, format?: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (format === 'percent') {
      return `${value}%`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Primary Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">
                  {formatValue(stat.value, stat.format)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {secondaryStats.map((stat) => (
          <Card key={stat.title} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">
                  {formatValue(stat.value, stat.format)}
                </p>
                {stat.subtitle && (
                  <p className="text-sm text-gray-400 mt-1">{stat.subtitle}</p>
                )}
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
