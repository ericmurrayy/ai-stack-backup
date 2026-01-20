// Murray's FSM - Customers Page
// ===============================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatPhone } from '@/lib/utils';
import { Users, Phone, Mail, MapPin, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Customer, Location } from '@/types/database';

interface CustomerWithLocations extends Customer {
  locations: Location[];
}

async function getCustomers(): Promise<CustomerWithLocations[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      locations(*)
    `)
    .eq('deleted', false)
    .order('name', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  return data || [];
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
            <div className="text-sm text-slate-500">With Phone</div>
            <div className="text-2xl font-bold text-green-600">
              {customers.filter((c) => c.phone).length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">With Email</div>
            <div className="text-2xl font-bold text-blue-600">
              {customers.filter((c) => c.email).length}
            </div>
          </Card>
        </div>

        {/* Customers Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All Customers</h2>
              <p className="text-sm text-slate-500">
                Manage your customer database
              </p>
            </div>
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
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
                    Locations
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-700 font-semibold">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="font-medium text-slate-900">{customer.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            {formatPhone(customer.phone)}
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
                      {customer.locations && customer.locations.length > 0 ? (
                        <div className="text-sm">
                          {customer.locations.map((loc, i) => (
                            <div key={loc.id} className="flex items-center gap-1 text-slate-600">
                              <MapPin className="w-3 h-3" />
                              {loc.city}, {loc.state}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">No locations</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {customer.notes ? (
                        <span className="text-sm text-slate-600 line-clamp-2">
                          {customer.notes}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        View
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
                        Add your first customer to get started
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
