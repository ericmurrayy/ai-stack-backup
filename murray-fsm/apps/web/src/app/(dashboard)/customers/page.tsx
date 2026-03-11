// Murray's FSM - Customers Page (with pagination)
// =================================================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatPhone } from '@/lib/utils';
import { Users, Phone, Mail, MapPin, Plus, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import Link from 'next/link';
import { CustomersFilters } from './CustomersFilters';
import { AddCustomerButton } from './AddCustomerButton';
import type { Customer, Location } from '@/types/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25; // matches DEFAULTS.PAGE_SIZE from @murray-fsm/shared

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerWithLocations extends Customer {
  locations: Location[];
}

interface CustomersResult {
  customers: CustomerWithLocations[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getCustomers(opts: {
  page: number;
  search?: string;
}): Promise<CustomersResult> {
  const supabase = await createClient();

  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('customers')
    .select('*, locations(*)', { count: 'exact' })
    .eq('deleted', false)
    .order('name', { ascending: true })
    .range(from, to);

  if (opts.search) {
    query = query.or(
      `name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,phone.ilike.%${opts.search}%,address.ilike.%${opts.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching customers:', error);
    return { customers: [], totalCount: 0 };
  }

  return {
    customers: (data as CustomerWithLocations[]) || [],
    totalCount: count ?? 0,
  };
}

async function getCustomerStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('phone, email')
    .eq('deleted', false);

  if (error || !data) return { total: 0, withPhone: 0, withEmail: 0 };
  return {
    total: data.length,
    withPhone: data.filter((c) => c.phone).length,
    withEmail: data.filter((c) => c.email).length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaginationUrl(page: number, search: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set('page', String(page));
  if (search) p.set('search', search);
  const qs = p.toString();
  return `/customers${qs ? `?${qs}` : ''}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const searchQuery = params.search || '';

  const [{ customers, totalCount }, stats] = await Promise.all([
    getCustomers({ page: currentPage, search: searchQuery }),
    getCustomerStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <Header title="Customers" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Customers</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">With Phone</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.withPhone}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">With Email</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.withEmail}
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
            <AddCustomerButton>
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Add Customer
              </Button>
            </AddCustomerButton>
          </div>

          {/* Search & Filter Bar */}
          <CustomersFilters currentSearch={searchQuery} />

          {customers.length === 0 ? (
            /* ---- Empty state ---- */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                <Inbox className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                No customers found
              </h3>
              <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
                {currentPage > 1
                  ? 'There are no customers on this page. Try going back to an earlier page.'
                  : 'No customers match the current search. Add a customer to get started.'}
              </p>
              {currentPage > 1 ? (
                <Link href="/customers?page=1">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                    Back to first page
                  </Button>
                </Link>
              ) : (
                <AddCustomerButton>
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Add Customer
                  </Button>
                </AddCustomerButton>
              )}
            </div>
          ) : (
            /* ---- Table ---- */
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
                            {customer.locations.map((loc) => (
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
                </tbody>
              </table>
            </div>
          )}

          {/* ---- Pagination controls ---- */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              {/* Showing range */}
              <p className="text-sm text-slate-500">
                Showing{' '}
                <span className="font-medium text-slate-700">
                  {(currentPage - 1) * PAGE_SIZE + 1}
                </span>
                {' '}-{' '}
                <span className="font-medium text-slate-700">
                  {Math.min(currentPage * PAGE_SIZE, totalCount)}
                </span>
                {' '}of{' '}
                <span className="font-medium text-slate-700">{totalCount}</span>{' '}
                customers
              </p>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link href={buildPaginationUrl(currentPage - 1, searchQuery)}>
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                )}

                <span className="px-3 text-sm font-medium text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>

                {currentPage < totalPages ? (
                  <Link href={buildPaginationUrl(currentPage + 1, searchQuery)}>
                    <Button variant="outline" size="sm">
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
