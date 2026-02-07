'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  Truck,
  Wrench,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Search,
  Filter,
  X,
  Edit,
  Trash2,
  Fuel,
  Settings,
} from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  type: 'vehicle' | 'tool' | 'equipment';
  make?: string;
  model?: string;
  year?: number;
  serial_number?: string;
  license_plate?: string;
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  assigned_to_id?: string;
  assigned_to_name?: string;
  current_job_id?: string;
  last_service_date?: string;
  next_service_date?: string;
  odometer?: number;
  fuel_level?: number;
  purchase_date?: string;
  purchase_cost?: number;
  notes?: string;
}

interface EquipmentStats {
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
  maintenanceDueSoon: number;
}

const statusConfig = {
  available: { label: 'Available', color: 'success', icon: CheckCircle },
  in_use: { label: 'In Use', color: 'info', icon: Clock },
  maintenance: { label: 'Maintenance', color: 'warning', icon: Wrench },
  out_of_service: { label: 'Out of Service', color: 'danger', icon: AlertTriangle },
} as const;

const typeIcons = {
  vehicle: Truck,
  tool: Wrench,
  equipment: Settings,
};

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [stats, setStats] = useState<EquipmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'equipment' as 'vehicle' | 'tool' | 'equipment',
    make: '',
    model: '',
    year: '',
    serial_number: '',
    license_plate: '',
    status: 'available' as Equipment['status'],
    notes: '',
  });

  useEffect(() => {
    fetchEquipment();
  }, []);

  async function fetchEquipment() {
    setLoading(true);
    try {
      const res = await fetch('/api/equipment');
      if (res.ok) {
        const data = await res.json();
        setEquipment(data.equipment || []);
        setStats(data.stats);
      } else {
        // Demo data
        setEquipment([
          {
            id: '1',
            name: 'Service Van #1',
            type: 'vehicle',
            make: 'Ford',
            model: 'Transit 250',
            year: 2022,
            license_plate: 'ABC-1234',
            status: 'in_use',
            assigned_to_id: '1',
            assigned_to_name: 'Mike Johnson',
            current_job_id: 'job-123',
            last_service_date: '2025-12-15',
            next_service_date: '2026-03-15',
            odometer: 45200,
            fuel_level: 75,
          },
          {
            id: '2',
            name: 'Service Van #2',
            type: 'vehicle',
            make: 'Chevrolet',
            model: 'Express 2500',
            year: 2021,
            license_plate: 'XYZ-5678',
            status: 'available',
            last_service_date: '2026-01-10',
            next_service_date: '2026-04-10',
            odometer: 38700,
            fuel_level: 50,
          },
          {
            id: '3',
            name: 'Pressure Washer',
            type: 'equipment',
            make: 'Simpson',
            model: 'Pro Series 4200',
            serial_number: 'SN-98765',
            status: 'maintenance',
            notes: 'Pump needs replacement',
          },
          {
            id: '4',
            name: 'Impact Drill Set',
            type: 'tool',
            make: 'Milwaukee',
            model: 'M18',
            serial_number: 'MW-12345',
            status: 'in_use',
            assigned_to_name: 'Sarah Williams',
          },
        ]);
        setStats({
          total: 4,
          available: 1,
          inUse: 2,
          maintenance: 1,
          maintenanceDueSoon: 1,
        });
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    try {
      const method = editingItem ? 'PATCH' : 'POST';
      const body = editingItem
        ? { id: editingItem.id, ...formData }
        : formData;

      const res = await fetch('/api/equipment', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          year: formData.year ? parseInt(formData.year) : undefined,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        fetchEquipment();
      }
    } catch (error) {
      console.error('Failed to save equipment:', error);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      type: 'equipment',
      make: '',
      model: '',
      year: '',
      serial_number: '',
      license_plate: '',
      status: 'available',
      notes: '',
    });
  }

  function openEditModal(item: Equipment) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      make: item.make || '',
      model: item.model || '',
      year: item.year?.toString() || '',
      serial_number: item.serial_number || '',
      license_plate: item.license_plate || '',
      status: item.status,
      notes: item.notes || '',
    });
    setShowModal(true);
  }

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div>
        <Header title="Equipment & Vehicles" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6 animate-pulse">
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
      <Header title="Equipment & Vehicles" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-slate-500">Total Items</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.available}</p>
                  <p className="text-sm text-slate-500">Available</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inUse}</p>
                  <p className="text-sm text-slate-500">In Use</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <Wrench className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.maintenance}</p>
                  <p className="text-sm text-slate-500">Maintenance</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.maintenanceDueSoon}</p>
                  <p className="text-sm text-slate-500">Service Due</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Header & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              <option value="vehicle">Vehicles</option>
              <option value="tool">Tools</option>
              <option value="equipment">Equipment</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Equipment
          </Button>
        </div>

        {/* Equipment List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEquipment.map((item) => {
            const TypeIcon = typeIcons[item.type];
            const statusInfo = statusConfig[item.status];
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      item.type === 'vehicle' ? 'bg-blue-100' :
                      item.type === 'tool' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      <TypeIcon className={`w-5 h-5 ${
                        item.type === 'vehicle' ? 'text-blue-600' :
                        item.type === 'tool' ? 'text-green-600' : 'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      {(item.make || item.model) && (
                        <p className="text-sm text-slate-500">
                          {[item.make, item.model, item.year].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusInfo.color as any}>
                    {statusInfo.label}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  {item.license_plate && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">🚗</span>
                      <span>{item.license_plate}</span>
                    </div>
                  )}
                  {item.serial_number && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">#</span>
                      <span>{item.serial_number}</span>
                    </div>
                  )}
                  {item.assigned_to_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{item.assigned_to_name}</span>
                    </div>
                  )}
                  {item.next_service_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Service: {new Date(item.next_service_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {item.odometer !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">📏</span>
                      <span>{item.odometer.toLocaleString()} mi</span>
                    </div>
                  )}
                  {item.fuel_level !== undefined && (
                    <div className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-slate-400" />
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.fuel_level > 50 ? 'bg-green-500' :
                            item.fuel_level > 25 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${item.fuel_level}%` }}
                        />
                      </div>
                      <span>{item.fuel_level}%</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredEquipment.length === 0 && (
          <Card className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No equipment found</h3>
            <p className="text-slate-500 mb-4">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first piece of equipment'}
            </p>
            {!searchQuery && filterType === 'all' && filterStatus === 'all' && (
              <Button onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Equipment
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingItem ? 'Edit Equipment' : 'Add Equipment'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingItem(null); }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Service Van #1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="vehicle">Vehicle</option>
                    <option value="tool">Tool</option>
                    <option value="equipment">Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="out_of_service">Out of Service</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Make
                  </label>
                  <Input
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="Ford"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Model
                  </label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Transit 250"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Year
                  </label>
                  <Input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="2022"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.type === 'vehicle' ? 'License Plate' : 'Serial Number'}
                  </label>
                  <Input
                    value={formData.type === 'vehicle' ? formData.license_plate : formData.serial_number}
                    onChange={(e) => setFormData({
                      ...formData,
                      [formData.type === 'vehicle' ? 'license_plate' : 'serial_number']: e.target.value
                    })}
                    placeholder={formData.type === 'vehicle' ? 'ABC-1234' : 'SN-12345'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowModal(false); setEditingItem(null); }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>
                {editingItem ? 'Save Changes' : 'Add Equipment'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
