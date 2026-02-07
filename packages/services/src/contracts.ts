/**
 * Service Contracts/Agreements Service
 * =====================================
 * Manage recurring service agreements with customers
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export type ContractStatus = 'draft' | 'pending' | 'active' | 'expired' | 'cancelled';
export type BillingFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type ServiceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'as_needed';

export interface ContractService {
  id: string;
  name: string;
  description?: string;
  frequency: ServiceFrequency;
  estimated_duration?: number; // minutes
  included_visits?: number; // per billing period
  price?: number;
}

export interface ServiceContract {
  id: string;
  contract_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;

  // Contract details
  name: string;
  description?: string;
  status: ContractStatus;

  // Dates
  start_date: string;
  end_date: string;
  signed_date?: string;

  // Billing
  billing_frequency: BillingFrequency;
  contract_value: number;
  monthly_rate?: number;
  payment_terms?: string;
  auto_renew: boolean;

  // Services included
  services: ContractService[];

  // Terms
  terms_and_conditions?: string;
  cancellation_policy?: string;

  // Tracking
  visits_used: number;
  visits_remaining?: number;
  next_service_date?: string;
  last_service_date?: string;

  // Metadata
  created_at: string;
  updated_at?: string;
  created_by?: string;
  signed_by_customer?: boolean;
  signature_url?: string;
  notes?: string;
}

export interface ContractFilter {
  customer_id?: string;
  status?: ContractStatus;
  expiring_within_days?: number;
  needs_renewal?: boolean;
  limit?: number;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  services: ContractService[];
  billing_frequency: BillingFrequency;
  duration_months: number;
  base_price: number;
  terms_and_conditions?: string;
  cancellation_policy?: string;
}

// Pre-defined contract templates
export const defaultContractTemplates: ContractTemplate[] = [
  {
    id: 'hvac-maintenance',
    name: 'HVAC Maintenance Agreement',
    description: 'Annual HVAC system maintenance with priority service',
    billing_frequency: 'annual',
    duration_months: 12,
    base_price: 299,
    services: [
      {
        id: 'hvac-tune-up',
        name: 'Seasonal Tune-Up',
        description: 'Complete system inspection and tune-up',
        frequency: 'quarterly',
        estimated_duration: 90,
        included_visits: 2,
      },
      {
        id: 'filter-replace',
        name: 'Filter Replacement',
        description: 'Standard filter replacement',
        frequency: 'quarterly',
        estimated_duration: 15,
        included_visits: 4,
      },
    ],
    terms_and_conditions: `
      1. Agreement is valid for 12 months from start date
      2. Services include labor only; parts billed separately at 15% discount
      3. Emergency service calls receive priority scheduling
      4. 10% discount on repairs not covered by agreement
      5. Agreement auto-renews unless cancelled 30 days before expiration
    `,
    cancellation_policy: 'Cancel anytime with 30 days notice. Prorated refund for unused portion.',
  },
  {
    id: 'plumbing-protection',
    name: 'Plumbing Protection Plan',
    description: 'Comprehensive plumbing coverage with annual inspection',
    billing_frequency: 'annual',
    duration_months: 12,
    base_price: 199,
    services: [
      {
        id: 'plumbing-inspection',
        name: 'Annual Plumbing Inspection',
        description: 'Full system inspection including water heater',
        frequency: 'annual',
        estimated_duration: 60,
        included_visits: 1,
      },
      {
        id: 'drain-cleaning',
        name: 'Drain Cleaning',
        description: 'Main line drain cleaning',
        frequency: 'as_needed',
        estimated_duration: 45,
        included_visits: 1,
      },
    ],
    terms_and_conditions: `
      1. Covers standard plumbing repairs up to $500/year
      2. Emergency service available 24/7
      3. 15% discount on services beyond coverage
      4. Does not cover damage from negligence or misuse
    `,
    cancellation_policy: 'Cancel with 30 days notice. No refunds after 6 months.',
  },
  {
    id: 'electrical-safety',
    name: 'Electrical Safety Plan',
    description: 'Annual electrical inspection and safety check',
    billing_frequency: 'annual',
    duration_months: 12,
    base_price: 249,
    services: [
      {
        id: 'electrical-inspection',
        name: 'Electrical Safety Inspection',
        description: 'Complete home electrical inspection',
        frequency: 'annual',
        estimated_duration: 90,
        included_visits: 1,
      },
      {
        id: 'panel-check',
        name: 'Panel Check',
        description: 'Breaker panel inspection and tightening',
        frequency: 'annual',
        estimated_duration: 30,
        included_visits: 1,
      },
    ],
    terms_and_conditions: `
      1. Includes comprehensive electrical safety report
      2. Priority scheduling for emergency calls
      3. 10% discount on all electrical repairs
      4. Free estimates on recommended upgrades
    `,
    cancellation_policy: 'Cancel anytime with prorated refund.',
  },
  {
    id: 'total-home',
    name: 'Total Home Protection',
    description: 'Complete coverage: HVAC, Plumbing, and Electrical',
    billing_frequency: 'monthly',
    duration_months: 12,
    base_price: 49, // per month
    services: [
      {
        id: 'hvac-tune-up',
        name: 'HVAC Tune-Up',
        frequency: 'quarterly',
        estimated_duration: 90,
        included_visits: 2,
      },
      {
        id: 'plumbing-inspection',
        name: 'Plumbing Inspection',
        frequency: 'annual',
        estimated_duration: 60,
        included_visits: 1,
      },
      {
        id: 'electrical-inspection',
        name: 'Electrical Inspection',
        frequency: 'annual',
        estimated_duration: 60,
        included_visits: 1,
      },
    ],
    terms_and_conditions: `
      1. Complete home coverage for all major systems
      2. 24/7 emergency service included
      3. 20% discount on all repairs
      4. No deductibles or service call fees
      5. Transferable to new homeowner
    `,
    cancellation_policy: 'Cancel anytime. No long-term commitment required.',
  },
];

export const contractsService = {
  /**
   * Generate unique contract number
   */
  generateContractNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SC-${year}-${random}`;
  },

  /**
   * Create a new service contract
   */
  async create(contract: Omit<ServiceContract, 'id' | 'contract_number' | 'created_at' | 'visits_used'>): Promise<{
    success: boolean;
    contractId?: string;
    contractNumber?: string;
    error?: string;
  }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const contractNumber = this.generateContractNumber();

    const { data, error } = await supabase
      .from('service_contracts')
      .insert({
        ...contract,
        contract_number: contractNumber,
        visits_used: 0,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Contracts] Create error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, contractId: data.id, contractNumber };
  },

  /**
   * Create contract from template
   */
  async createFromTemplate(
    templateId: string,
    customerId: string,
    customerInfo: { name: string; email?: string; phone?: string },
    startDate: string,
    customizations?: Partial<ServiceContract>
  ): Promise<{ success: boolean; contractId?: string; contractNumber?: string; error?: string }> {
    const template = defaultContractTemplates.find(t => t.id === templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + template.duration_months);

    const contract: Omit<ServiceContract, 'id' | 'contract_number' | 'created_at' | 'visits_used'> = {
      customer_id: customerId,
      customer_name: customerInfo.name,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      name: template.name,
      description: template.description,
      status: 'draft',
      start_date: startDate,
      end_date: endDate.toISOString().split('T')[0],
      billing_frequency: template.billing_frequency,
      contract_value: template.billing_frequency === 'monthly'
        ? template.base_price * template.duration_months
        : template.base_price,
      monthly_rate: template.billing_frequency === 'monthly'
        ? template.base_price
        : Math.round(template.base_price / 12 * 100) / 100,
      auto_renew: true,
      services: template.services,
      terms_and_conditions: template.terms_and_conditions,
      cancellation_policy: template.cancellation_policy,
      ...customizations,
    };

    return this.create(contract);
  },

  /**
   * Get contract by ID
   */
  async getById(id: string): Promise<ServiceContract | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('service_contracts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Contracts] Get error:', error);
      return null;
    }

    return data;
  },

  /**
   * Get contracts with filters
   */
  async getContracts(filter: ContractFilter = {}): Promise<ServiceContract[]> {
    if (!supabase) return [];

    let query = supabase
      .from('service_contracts')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter.customer_id) {
      query = query.eq('customer_id', filter.customer_id);
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    if (filter.expiring_within_days) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filter.expiring_within_days);
      query = query
        .eq('status', 'active')
        .lte('end_date', futureDate.toISOString().split('T')[0]);
    }
    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Contracts] Query error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Update contract
   */
  async update(id: string, updates: Partial<ServiceContract>): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
      .from('service_contracts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[Contracts] Update error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Activate a contract (after signing)
   */
  async activate(id: string, signedDate?: string): Promise<{ success: boolean; error?: string }> {
    return this.update(id, {
      status: 'active',
      signed_date: signedDate || new Date().toISOString().split('T')[0],
      signed_by_customer: true,
    });
  },

  /**
   * Cancel a contract
   */
  async cancel(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    return this.update(id, {
      status: 'cancelled',
      notes: reason ? `Cancelled: ${reason}` : 'Contract cancelled',
    });
  },

  /**
   * Record a service visit against a contract
   */
  async recordVisit(id: string, serviceId: string, jobId?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Get current contract
    const contract = await this.getById(id);
    if (!contract) {
      return { success: false, error: 'Contract not found' };
    }

    // Log the visit
    await supabase.from('contract_visits').insert({
      contract_id: id,
      service_id: serviceId,
      job_id: jobId,
      visit_date: new Date().toISOString(),
    });

    // Update visit count
    return this.update(id, {
      visits_used: contract.visits_used + 1,
      last_service_date: new Date().toISOString().split('T')[0],
    });
  },

  /**
   * Renew a contract
   */
  async renew(id: string, newEndDate?: string): Promise<{ success: boolean; newContractId?: string; error?: string }> {
    const contract = await this.getById(id);
    if (!contract) {
      return { success: false, error: 'Contract not found' };
    }

    // Calculate new dates
    const newStartDate = contract.end_date;
    const endDate = newEndDate || (() => {
      const d = new Date(newStartDate);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    })();

    // Create new contract
    const result = await this.create({
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      customer_email: contract.customer_email,
      customer_phone: contract.customer_phone,
      name: contract.name,
      description: contract.description,
      status: 'pending',
      start_date: newStartDate,
      end_date: endDate,
      billing_frequency: contract.billing_frequency,
      contract_value: contract.contract_value,
      monthly_rate: contract.monthly_rate,
      auto_renew: contract.auto_renew,
      services: contract.services,
      terms_and_conditions: contract.terms_and_conditions,
      cancellation_policy: contract.cancellation_policy,
      notes: `Renewed from contract ${contract.contract_number}`,
    });

    if (result.success) {
      // Mark old contract as expired
      await this.update(id, { status: 'expired' });
    }

    return { success: result.success, newContractId: result.contractId, error: result.error };
  },

  /**
   * Get contracts expiring soon
   */
  async getExpiringSoon(days = 30): Promise<ServiceContract[]> {
    return this.getContracts({ expiring_within_days: days });
  },

  /**
   * Get contract statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    expired: number;
    totalValue: number;
    monthlyRecurring: number;
    expiringSoon: number;
  }> {
    if (!supabase) {
      return {
        total: 0,
        active: 0,
        pending: 0,
        expired: 0,
        totalValue: 0,
        monthlyRecurring: 0,
        expiringSoon: 0,
      };
    }

    const { data: contracts } = await supabase
      .from('service_contracts')
      .select('status, contract_value, monthly_rate, end_date');

    if (!contracts) {
      return {
        total: 0,
        active: 0,
        pending: 0,
        expired: 0,
        totalValue: 0,
        monthlyRecurring: 0,
        expiringSoon: 0,
      };
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const stats = {
      total: contracts.length,
      active: contracts.filter(c => c.status === 'active').length,
      pending: contracts.filter(c => c.status === 'pending' || c.status === 'draft').length,
      expired: contracts.filter(c => c.status === 'expired').length,
      totalValue: contracts
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + (c.contract_value || 0), 0),
      monthlyRecurring: contracts
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + (c.monthly_rate || 0), 0),
      expiringSoon: contracts.filter(c =>
        c.status === 'active' &&
        new Date(c.end_date) <= thirtyDaysFromNow
      ).length,
    };

    return stats;
  },

  /**
   * Get available templates
   */
  getTemplates(): ContractTemplate[] {
    return defaultContractTemplates;
  },
};

export default contractsService;
