// Murray's FSM - Billing Settings
// ==================================
// Plan management, payment method, and billing history

'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  CreditCard,
  ArrowLeft,
  Check,
  Star,
  Zap,
  Building2,
  Download,
  ChevronRight,
  Crown,
} from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    period: 'mo',
    description: 'Perfect for solo operators',
    features: [
      'Up to 50 jobs/month',
      '1 technician',
      'Basic scheduling',
      'Customer portal',
      'Email support',
    ],
    icon: <Star className="w-5 h-5" />,
    current: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 129,
    period: 'mo',
    description: 'For growing businesses',
    features: [
      'Unlimited jobs',
      'Up to 10 technicians',
      'Dispatch board',
      'Estimates & invoicing',
      'Integrations',
      'Priority support',
    ],
    icon: <Zap className="w-5 h-5" />,
    current: true,
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    period: 'mo',
    description: 'For large operations',
    features: [
      'Everything in Professional',
      'Unlimited technicians',
      'Custom automations',
      'API access',
      'White-label portal',
      'Dedicated support',
      'SLA guarantee',
    ],
    icon: <Building2 className="w-5 h-5" />,
    current: false,
  },
];

const invoices = [
  { id: 'INV-2026-003', date: 'Mar 1, 2026', amount: '$129.00', status: 'Paid' },
  { id: 'INV-2026-002', date: 'Feb 1, 2026', amount: '$129.00', status: 'Paid' },
  { id: 'INV-2026-001', date: 'Jan 1, 2026', amount: '$129.00', status: 'Paid' },
  { id: 'INV-2025-012', date: 'Dec 1, 2025', amount: '$49.00', status: 'Paid' },
  { id: 'INV-2025-011', date: 'Nov 1, 2025', amount: '$49.00', status: 'Paid' },
];

export default function BillingPage() {
  return (
    <div>
      <Header title="Billing & Subscription" />

      <div className="p-6 space-y-6 max-w-5xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        {/* Current Plan */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Crown className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Professional Plan</h2>
                  <Badge className="bg-blue-100 text-blue-800">Current</Badge>
                </div>
                <p className="text-sm text-slate-500">
                  $129/month · Renews on April 1, 2026 · 6 of 10 technician seats used
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Manage Plan
            </Button>
          </div>
        </Card>

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Available Plans</h2>
          <div className="grid grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-6 relative ${
                  plan.current ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white text-xs px-3">Most Popular</Badge>
                  </div>
                )}
                <div className="text-center mb-4">
                  <div className={`inline-flex p-2.5 rounded-xl mb-3 ${
                    plan.current ? 'bg-blue-50' : 'bg-slate-50'
                  }`}>
                    {plan.icon}
                  </div>
                  <h3 className="font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                </div>
                <div className="text-center mb-4">
                  <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                  <span className="text-slate-500">/{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className={`w-4 h-4 flex-shrink-0 ${
                        plan.current ? 'text-blue-500' : 'text-green-500'
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.current ? 'outline' : 'primary'}
                  className="w-full"
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : 'Upgrade'}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-100 rounded-xl">
                <CreditCard className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Payment Method</h3>
                <p className="text-sm text-slate-500">Visa ending in 4242 · Expires 12/2027</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Update Card
            </Button>
          </div>
        </Card>

        {/* Billing History */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Billing History</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Invoice</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-mono text-slate-900">{inv.id}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{inv.date}</td>
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{inv.amount}</td>
                  <td className="px-6 py-3">
                    <Badge className="bg-green-100 text-green-800 text-xs">{inv.status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button className="text-slate-400 hover:text-slate-600" aria-label={`Download ${inv.id}`}>
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
