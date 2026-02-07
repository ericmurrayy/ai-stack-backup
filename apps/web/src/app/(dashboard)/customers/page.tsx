// Murray's FSM - Customers Page
// ===============================
// Note: Customer data is derived from jobs in this implementation

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { formatPhone } from '@/lib/utils';
import { Users, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { AddCustomerButton } from './CustomerActions';

interface CustomerFromJobs {
  customer_name: string;
  phone_number: string;
  phone_e164: string;
  email: string | null;
  city: string | null;
  address: string | null;
  job_count: number;
  last_job_date: string;
}

async function getCustomers(): Promise<CustomerFromJobs[]> {
  const supabase = createAdminClient();

  // Get unique customers from jobs table
  const { data, error } = await supabase
    .from('jobs')
    .select('customer_name, phone_number, phone_e164, email, city, address, created_at')
    .eq('is_spam', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  // Group by phone number to get unique customers
  const customerMap = new Map<string, CustomerFromJobs>();

  (data || []).forEach(job => {
    const key = job.phone_e164 || job.phone_number;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customer_name: job.customer_name || 'Unknown',
        phone_number: job.phone_number,
        phone_e164: job.phone_e164,
        email: job.email,
        city: job.city,
        address: job.address,
        job_count: 1,
        last_job_date: job.created_at,
      });
    } else {
      const existing = customerMap.get(key)!;
      existing.job_count += 1;
      // Update with latest info if available
      if (job.customer_name && job.customer_name !== 'Unknown') {
        existing.customer_name = job.customer_name;
      }
      if (job.email && !existing.email) {
        existing.email = job.email;
      }
    }
  });

  return Array.from(customerMap.values()).sort((a, b) =>
    a.customer_name.localeCompare(b.customer_name)
  );
}

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div>
      <Header title="Customers" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Customers</div>
            <div className="text-2xl font-bold text-slate-900">{customers.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">With Email</div>
            <div className="text-2xl font-bold text-blue-600">
              {customers.filter((c) => c.email).length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Jobs</div>
            <div className="text-2xl font-bold text-green-600">
              {customers.reduce((sum, c) => sum + c.job_count, 0)}
            </div>
          </Card>
        </div>

        {/* Customers Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All Customers</h2>
              <p className="text-sm text-slate-500">
                Customers derived from job history
              </p>
            </div>
            <AddCustomerButton size="sm" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Jobs
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customers.map((customer, idx) => (
                  <tr key={customer.phone_e164 || idx} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-700 font-semibold">
                            {customer.customer_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="font-medium text-slate-900">{customer.customer_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {customer.phone_number && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            {formatPhone(customer.phone_number)}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.city ? (
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <MapPin className="w-3 h-3" />
                          {customer.city}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Briefcase className="w-3 h-3" />
                        {customer.job_count} job{customer.job_count !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/jobs?phone=${encodeURIComponent(customer.phone_e164)}`}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        View Jobs
                      </Link>
                    </td>
                  </tr>
                ))}

                {customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <div className="text-slate-500">No customers yet</div>
                      <div className="text-sm text-slate-400">
                        Customers will appear here when jobs are created
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
