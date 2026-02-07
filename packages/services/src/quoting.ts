/**
 * Quote Generation Service
 * ========================
 * Generate quotes/estimates for jobs using AI
 *
 * Features:
 * - AI-powered pricing suggestions
 * - Template-based quotes
 * - Service catalog integration
 * - Automatic follow-ups
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jarvisBridge } from './jarvis-bridge';

// Use any for now until Supabase types are generated
type SupabaseClientAny = SupabaseClient<any, any, any>;

// Types
export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  items: QuoteItem[];
  laborHours?: number;
  laborRate?: number;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  validUntil: string;
  notes?: string;
  aiGenerated?: boolean;
  jobDescription?: string;
  createdAt: string;
}

export interface GenerateQuoteParams {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  jobDescription: string;
  preferredDate?: string;
  address?: string;
  urgency?: 'normal' | 'urgent' | 'emergency';
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  priceUnit: 'fixed' | 'per_hour' | 'per_sqft' | 'per_unit';
  estimatedHours?: number;
}

class QuotingService {
  private supabase: SupabaseClientAny | null = null;
  private defaultLaborRate: number;
  private defaultTaxRate: number;
  private quoteValidityDays: number;

  constructor() {
    this.defaultLaborRate = parseFloat(process.env.DEFAULT_LABOR_RATE || '85');
    this.defaultTaxRate = parseFloat(process.env.DEFAULT_TAX_RATE || '8.25');
    this.quoteValidityDays = parseInt(process.env.QUOTE_VALIDITY_DAYS || '30');

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  /**
   * Generate quote number
   */
  private async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    if (!this.supabase) {
      return `QT-${year}${month}-${Math.floor(Math.random() * 10000)}`;
    }

    const { count } = await this.supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-${month}-01`);

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `QT-${year}${month}-${sequence}`;
  }

  /**
   * Get service catalog items
   */
  async getServiceCatalog(): Promise<ServiceCatalogItem[]> {
    if (!this.supabase) {
      // Return default catalog if no database
      return this.getDefaultCatalog();
    }

    const { data } = await this.supabase
      .from('service_catalog')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true });

    return data || this.getDefaultCatalog();
  }

  /**
   * Default service catalog
   */
  private getDefaultCatalog(): ServiceCatalogItem[] {
    return [
      // HVAC
      { id: '1', name: 'AC Tune-Up', description: 'Annual AC maintenance', category: 'HVAC', basePrice: 129, priceUnit: 'fixed', estimatedHours: 1.5 },
      { id: '2', name: 'Furnace Tune-Up', description: 'Annual furnace maintenance', category: 'HVAC', basePrice: 99, priceUnit: 'fixed', estimatedHours: 1 },
      { id: '3', name: 'AC Repair - Minor', description: 'Minor AC repair', category: 'HVAC', basePrice: 250, priceUnit: 'fixed', estimatedHours: 2 },
      { id: '4', name: 'AC Repair - Major', description: 'Major AC repair', category: 'HVAC', basePrice: 500, priceUnit: 'fixed', estimatedHours: 4 },
      { id: '5', name: 'AC Installation', description: 'New AC system installation', category: 'HVAC', basePrice: 3500, priceUnit: 'fixed', estimatedHours: 8 },

      // Plumbing
      { id: '6', name: 'Drain Cleaning', description: 'Clear clogged drain', category: 'Plumbing', basePrice: 150, priceUnit: 'fixed', estimatedHours: 1 },
      { id: '7', name: 'Water Heater Repair', description: 'Water heater repair', category: 'Plumbing', basePrice: 200, priceUnit: 'fixed', estimatedHours: 2 },
      { id: '8', name: 'Pipe Repair', description: 'Fix leaking pipe', category: 'Plumbing', basePrice: 175, priceUnit: 'fixed', estimatedHours: 1.5 },
      { id: '9', name: 'Faucet Installation', description: 'Install new faucet', category: 'Plumbing', basePrice: 125, priceUnit: 'fixed', estimatedHours: 1 },
      { id: '10', name: 'Toilet Repair', description: 'Fix toilet issues', category: 'Plumbing', basePrice: 100, priceUnit: 'fixed', estimatedHours: 1 },

      // Electrical
      { id: '11', name: 'Outlet Installation', description: 'Install new outlet', category: 'Electrical', basePrice: 150, priceUnit: 'fixed', estimatedHours: 1 },
      { id: '12', name: 'Light Fixture Installation', description: 'Install light fixture', category: 'Electrical', basePrice: 125, priceUnit: 'fixed', estimatedHours: 1 },
      { id: '13', name: 'Panel Upgrade', description: 'Electrical panel upgrade', category: 'Electrical', basePrice: 2000, priceUnit: 'fixed', estimatedHours: 6 },
      { id: '14', name: 'Ceiling Fan Installation', description: 'Install ceiling fan', category: 'Electrical', basePrice: 175, priceUnit: 'fixed', estimatedHours: 1.5 },

      // General
      { id: '15', name: 'Service Call', description: 'Diagnostic service call', category: 'General', basePrice: 89, priceUnit: 'fixed', estimatedHours: 0.5 },
      { id: '16', name: 'Emergency Service', description: 'After-hours emergency', category: 'General', basePrice: 150, priceUnit: 'per_hour', estimatedHours: 1 },
    ];
  }

  /**
   * Generate quote using AI
   */
  async generateQuote(params: GenerateQuoteParams): Promise<Quote> {
    const { customerName, customerPhone, customerEmail, jobDescription, urgency = 'normal' } = params;

    // Use AI to analyze job description and suggest pricing
    const aiSuggestion = await this.getAIPricingSuggestion(jobDescription);

    // Get matching services from catalog
    const catalog = await this.getServiceCatalog();
    const matchedServices = this.matchServicesFromDescription(jobDescription, catalog);

    // Build quote items
    const items: QuoteItem[] = [];
    let totalHours = 0;

    if (aiSuggestion.suggestedItems) {
      for (const item of aiSuggestion.suggestedItems) {
        items.push({
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.price,
          total: (item.quantity || 1) * item.price,
          category: item.category,
        });
        totalHours += item.hours || 0;
      }
    } else if (matchedServices.length > 0) {
      // Use matched catalog services
      for (const service of matchedServices) {
        items.push({
          description: service.name,
          quantity: 1,
          unitPrice: service.basePrice,
          total: service.basePrice,
          category: service.category,
        });
        totalHours += service.estimatedHours || 0;
      }
    } else {
      // Fallback - create generic quote
      items.push({
        description: 'Service Call & Diagnostic',
        quantity: 1,
        unitPrice: 89,
        total: 89,
        category: 'General',
      });
      items.push({
        description: 'Labor (Estimated)',
        quantity: 2,
        unitPrice: this.defaultLaborRate,
        total: 2 * this.defaultLaborRate,
        category: 'Labor',
      });
      totalHours = 2;
    }

    // Apply urgency multiplier
    const urgencyMultiplier = urgency === 'emergency' ? 1.5 : urgency === 'urgent' ? 1.25 : 1;
    if (urgencyMultiplier > 1) {
      for (const item of items) {
        item.unitPrice = Math.round(item.unitPrice * urgencyMultiplier);
        item.total = item.quantity * item.unitPrice;
      }
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * (this.defaultTaxRate / 100);
    const total = subtotal + tax;

    // Calculate validity date
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + this.quoteValidityDays);

    // Generate quote number
    const quoteNumber = await this.generateQuoteNumber();

    const quote: Quote = {
      id: crypto.randomUUID(),
      quoteNumber,
      customerId: params.customerId || '',
      customerName,
      customerPhone,
      customerEmail,
      items,
      laborHours: totalHours,
      laborRate: this.defaultLaborRate,
      subtotal,
      tax,
      taxRate: this.defaultTaxRate,
      total,
      status: 'draft',
      validUntil: validUntil.toISOString(),
      notes: aiSuggestion.notes || undefined,
      aiGenerated: true,
      jobDescription,
      createdAt: new Date().toISOString(),
    };

    // Save to database
    if (this.supabase) {
      await this.supabase.from('quotes').insert({
        id: quote.id,
        quote_number: quote.quoteNumber,
        customer_id: quote.customerId || null,
        customer_name: quote.customerName,
        customer_phone: quote.customerPhone,
        customer_email: quote.customerEmail,
        items: quote.items,
        labor_hours: quote.laborHours,
        labor_rate: quote.laborRate,
        subtotal: quote.subtotal,
        tax: quote.tax,
        tax_rate: quote.taxRate,
        total: quote.total,
        status: quote.status,
        valid_until: quote.validUntil,
        notes: quote.notes,
        ai_generated: quote.aiGenerated,
        job_description: quote.jobDescription,
        created_at: quote.createdAt,
      });
    }

    return quote;
  }

  /**
   * Use AI to suggest pricing
   */
  private async getAIPricingSuggestion(jobDescription: string): Promise<{
    suggestedItems?: { description: string; price: number; quantity?: number; hours?: number; category?: string }[];
    notes?: string;
  }> {
    try {
      const prompt = `
You are a pricing assistant for a field service business. Based on the following job description, suggest appropriate line items and pricing.

Job Description: ${jobDescription}

Respond in JSON format:
{
  "suggestedItems": [
    { "description": "item name", "price": 100, "quantity": 1, "hours": 1, "category": "HVAC/Plumbing/Electrical/General" }
  ],
  "notes": "Any relevant notes about the job"
}

Use realistic pricing for a professional service company. Include labor if applicable.
`;

      const response = await jarvisBridge.queryOllama(prompt);

      // Try to parse AI response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[Quoting] AI pricing suggestion failed:', error);
    }

    return {};
  }

  /**
   * Match services from description using keywords
   */
  private matchServicesFromDescription(description: string, catalog: ServiceCatalogItem[]): ServiceCatalogItem[] {
    const desc = description.toLowerCase();
    const matched: ServiceCatalogItem[] = [];

    const keywords: Record<string, string[]> = {
      'AC Tune-Up': ['ac tune', 'ac maintenance', 'air conditioning maintenance', 'hvac tune'],
      'AC Repair': ['ac repair', 'ac fix', 'ac broken', 'air conditioning repair', 'ac not working', 'ac not cooling'],
      'Furnace Tune-Up': ['furnace tune', 'furnace maintenance', 'heating maintenance', 'heater tune'],
      'Drain Cleaning': ['drain', 'clog', 'blocked', 'slow drain', 'backed up'],
      'Water Heater': ['water heater', 'hot water', 'no hot water'],
      'Pipe Repair': ['leak', 'pipe', 'drip', 'leaking'],
      'Faucet': ['faucet', 'tap', 'sink'],
      'Toilet': ['toilet', 'bathroom', 'commode'],
      'Outlet': ['outlet', 'plug', 'socket', 'receptacle'],
      'Light': ['light', 'lighting', 'lamp', 'fixture'],
      'Panel': ['panel', 'breaker', 'circuit', 'electrical panel'],
      'Fan': ['fan', 'ceiling fan'],
      'Emergency': ['emergency', 'urgent', 'asap', 'right away', 'immediately'],
    };

    for (const service of catalog) {
      for (const [keyword, patterns] of Object.entries(keywords)) {
        if (service.name.includes(keyword) && patterns.some(p => desc.includes(p))) {
          if (!matched.find(m => m.id === service.id)) {
            matched.push(service);
          }
        }
      }
    }

    // Add service call if nothing specific matched
    if (matched.length === 0) {
      const serviceCall = catalog.find(s => s.name === 'Service Call');
      if (serviceCall) matched.push(serviceCall);
    }

    return matched;
  }

  /**
   * Send quote to customer
   */
  async sendQuote(quoteId: string, channels: ('email' | 'sms' | 'whatsapp')[]): Promise<{ success: boolean; sentVia: string[] }> {
    if (!this.supabase) return { success: false, sentVia: [] };

    const { data: quote } = await this.supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    const sentVia: string[] = [];
    const quoteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/quote/${quoteId}`;

    const message = `Hi ${quote.customer_name}! Here's your quote #${quote.quote_number} for $${quote.total.toFixed(2)}. ` +
      `View details and accept: ${quoteUrl} ` +
      `Valid until ${new Date(quote.valid_until).toLocaleDateString()}`;

    for (const channel of channels) {
      try {
        if (channel === 'whatsapp' && quote.customer_phone) {
          const result = await jarvisBridge.sendWhatsApp(quote.customer_phone, message);
          if (result.success) sentVia.push('whatsapp');
        }
        // Email would be sent via /api/email
      } catch (error) {
        console.error(`[Quoting] Failed to send via ${channel}:`, error);
      }
    }

    if (sentVia.length > 0) {
      await this.supabase
        .from('quotes')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', quoteId);
    }

    return { success: sentVia.length > 0, sentVia };
  }

  /**
   * Accept quote and create job
   */
  async acceptQuote(quoteId: string, preferredDate?: string): Promise<{ jobId: string }> {
    if (!this.supabase) throw new Error('Database not configured');

    const { data: quote } = await this.supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (!quote) throw new Error(`Quote not found: ${quoteId}`);

    // Create job from quote
    const { data: job, error } = await this.supabase
      .from('jobs')
      .insert({
        customer_id: quote.customer_id,
        title: quote.job_description || `Service - Quote #${quote.quote_number}`,
        description: `From Quote #${quote.quote_number}\n\n${quote.notes || ''}`,
        quoted_amount: quote.total,
        status: preferredDate ? 'scheduled' : 'pending',
        scheduled_date: preferredDate,
        source: 'quote',
        quote_id: quoteId,
      })
      .select()
      .single();

    if (error) throw error;

    // Update quote status
    await this.supabase
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        job_id: job.id,
      })
      .eq('id', quoteId);

    return { jobId: job.id };
  }

  /**
   * Get quote stats
   */
  async getStats(): Promise<{
    totalQuotes: number;
    sent: number;
    accepted: number;
    conversionRate: number;
    totalValue: number;
  }> {
    if (!this.supabase) {
      return { totalQuotes: 0, sent: 0, accepted: 0, conversionRate: 0, totalValue: 0 };
    }

    const { data } = await this.supabase
      .from('quotes')
      .select('status, total');

    const stats = {
      totalQuotes: data?.length || 0,
      sent: 0,
      accepted: 0,
      conversionRate: 0,
      totalValue: 0,
    };

    for (const quote of data || []) {
      if (['sent', 'viewed', 'accepted'].includes(quote.status)) stats.sent++;
      if (quote.status === 'accepted') {
        stats.accepted++;
        stats.totalValue += quote.total;
      }
    }

    stats.conversionRate = stats.sent > 0
      ? Math.round((stats.accepted / stats.sent) * 100)
      : 0;

    return stats;
  }
}

// Export singleton
export const quotingService = new QuotingService();
export default quotingService;
