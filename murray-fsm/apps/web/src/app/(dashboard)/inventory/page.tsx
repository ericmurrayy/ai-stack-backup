// Murray's FSM - Inventory Management
// ====================================
// Parts tracking, costs, and reorder alerts

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents } from '@/lib/utils';
import {
  Package,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Edit,
  Trash2,
  Archive,
} from 'lucide-react';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity_on_hand: number;
  reorder_point: number;
  cost_cents: number;
  price_cents: number;
  supplier: string;
  is_active: boolean;
}

async function getInventoryData() {
  // In production, fetch from Supabase
  const items: InventoryItem[] = [
    {
      id: '1',
      sku: 'SPR-001',
      name: 'Torsion Spring (Standard)',
      category: 'Springs',
      quantity_on_hand: 12,
      reorder_point: 5,
      cost_cents: 4500,
      price_cents: 12500,
      supplier: 'ABC Parts Co.',
      is_active: true,
    },
    {
      id: '2',
      sku: 'SPR-002',
      name: 'Torsion Spring (Heavy Duty)',
      category: 'Springs',
      quantity_on_hand: 4,
      reorder_point: 5,
      cost_cents: 6500,
      price_cents: 17500,
      supplier: 'ABC Parts Co.',
      is_active: true,
    },
    {
      id: '3',
      sku: 'OPN-001',
      name: 'Belt Drive Opener',
      category: 'Openers',
      quantity_on_hand: 3,
      reorder_point: 3,
      cost_cents: 18000,
      price_cents: 35000,
      supplier: 'LiftMaster Dist.',
      is_active: true,
    },
    {
      id: '4',
      sku: 'RLR-001',
      name: 'Nylon Roller (10-pack)',
      category: 'Rollers',
      quantity_on_hand: 25,
      reorder_point: 10,
      cost_cents: 2500,
      price_cents: 7500,
      supplier: 'ABC Parts Co.',
      is_active: true,
    },
    {
      id: '5',
      sku: 'PNL-001',
      name: 'Steel Panel Section',
      category: 'Panels',
      quantity_on_hand: 2,
      reorder_point: 4,
      cost_cents: 15000,
      price_cents: 32500,
      supplier: 'Clopay Dist.',
      is_active: true,
    },
    {
      id: '6',
      sku: 'CBL-001',
      name: 'Lift Cable Set',
      category: 'Cables',
      quantity_on_hand: 8,
      reorder_point: 5,
      cost_cents: 3500,
      price_cents: 9500,
      supplier: 'ABC Parts Co.',
      is_active: true,
    },
  ];

  const lowStock = items.filter(i => i.quantity_on_hand <= i.reorder_point);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity_on_hand * i.cost_cents), 0);
  const categories = Array.from(new Set(items.map(i => i.category)));

  return { items, lowStock, totalValue, categories };
}

function InventoryTable({ items }: { items: InventoryItem[] }) {
  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Item
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                SKU
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Category
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                In Stock
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Cost
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Price
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Margin
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item) => {
              const margin = item.cost_cents > 0
                ? Math.round(((item.price_cents - item.cost_cents) / item.cost_cents) * 100)
                : 0;
              const isLowStock = item.quantity_on_hand <= item.reorder_point;

              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.supplier}</div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm bg-slate-100 px-2 py-0.5 rounded">
                      {item.sku}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{item.category}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-medium ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                      {item.quantity_on_hand}
                    </span>
                    {isLowStock && (
                      <AlertTriangle className="w-4 h-4 text-red-500 inline ml-1" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {formatCents(item.cost_cents)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">
                    {formatCents(item.price_cents)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-medium ${margin >= 50 ? 'text-green-600' : 'text-slate-600'}`}>
                      {margin}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {isLowStock ? (
                      <Badge className="bg-red-100 text-red-800">Low Stock</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">In Stock</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 hover:bg-slate-100 rounded" title="Edit">
                        <Edit className="w-4 h-4 text-slate-500" />
                      </button>
                      <button className="p-1.5 hover:bg-slate-100 rounded" title="More">
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function InventoryPage() {
  const { items, lowStock, totalValue, categories } = await getInventoryData();

  return (
    <div>
      <Header title="Inventory Management" />

      <div className="p-6 space-y-6">
        {/* Inventory Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{items.length}</div>
                <div className="text-sm text-slate-500">Total Items</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{formatCents(totalValue)}</div>
                <div className="text-sm text-slate-500">Inventory Value</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${lowStock.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <AlertTriangle className={`w-5 h-5 ${lowStock.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${lowStock.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {lowStock.length}
                </div>
                <div className="text-sm text-slate-500">Low Stock Items</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Archive className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{categories.length}</div>
                <div className="text-sm text-slate-500">Categories</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div className="flex-1">
                <div className="font-medium text-red-800">
                  {lowStock.length} item{lowStock.length > 1 ? 's' : ''} need reordering
                </div>
                <div className="text-sm text-red-600">
                  {lowStock.map(i => i.name).join(', ')}
                </div>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50">
                Create Purchase Order
              </button>
            </div>
          </Card>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search inventory..."
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <InventoryTable items={items} />
      </div>
    </div>
  );
}
