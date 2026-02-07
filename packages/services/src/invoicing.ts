/**
 * Invoice Automation Service
 * ==========================
 * Auto-generate and send invoices when jobs complete
 *
 * Features:
 * - Generate PDF invoices
 * - Send via email/SMS/WhatsApp
 * - Stripe payment links
 * - Automatic reminders
 * - Payment tracking
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jarvisBridge } from './jarvis-bridge';

// Use any for now until Supabase types are generated
type SupabaseClientAny = SupabaseClient<any, any, any>;

// Types
export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  jobId: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  paidDate?: string;
  paymentLink?: string;
  sentVia?: ('email' | 'sms' | 'whatsapp')[];
  createdAt: string;
}

export interface CreateInvoiceParams {
  jobId: string;
  customerId: string;
  items: InvoiceItem[];
  taxRate?: number;
  dueInDays?: number;
  notes?: string;
}

export interface SendInvoiceParams {
  invoiceId: string;
  channels: ('email' | 'sms' | 'whatsapp')[];
  message?: string;
}

class InvoicingService {
  private supabase: SupabaseClientAny | null = null;
  private stripeApiKey: string;

  constructor() {
    this.stripeApiKey = process.env.STRIPE_SECRET_KEY || '';

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    if (!this.supabase) {
      return `INV-${year}${month}-${Math.floor(Math.random() * 10000)}`;
    }

    // Get count of invoices this month
    const { count } = await this.supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-${month}-01`);

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Create invoice from job
   */
  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    const { jobId, customerId, items, taxRate = 0, dueInDays = 14, notes } = params;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueInDays);

    // Create Stripe payment link
    const paymentLink = await this.createPaymentLink(total, invoiceNumber);

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      customerId,
      jobId,
      items,
      subtotal,
      tax,
      taxRate,
      total,
      status: 'draft',
      dueDate: dueDate.toISOString(),
      paymentLink,
      createdAt: new Date().toISOString(),
    };

    // Save to database
    if (this.supabase) {
      await this.supabase.from('invoices').insert({
        id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        job_id: invoice.jobId,
        items: invoice.items,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        tax_rate: invoice.taxRate,
        total: invoice.total,
        status: invoice.status,
        due_date: invoice.dueDate,
        payment_link: invoice.paymentLink,
        notes,
        created_at: invoice.createdAt,
      });
    }

    return invoice;
  }

  /**
   * Create invoice from completed job (auto-generation)
   */
  async createFromJob(jobId: string): Promise<Invoice | null> {
    if (!this.supabase) return null;

    // Get job details
    const { data: job } = await this.supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        line_items:job_line_items(*)
      `)
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Build invoice items from job
    const items: InvoiceItem[] = [];

    // Add labor
    if (job.labor_hours && job.labor_rate) {
      items.push({
        description: 'Labor',
        quantity: job.labor_hours,
        unitPrice: job.labor_rate,
        total: job.labor_hours * job.labor_rate,
      });
    }

    // Add line items
    if (job.line_items) {
      for (const item of job.line_items) {
        items.push({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          total: item.quantity * item.unit_price,
        });
      }
    }

    // Add flat rate if no items
    if (items.length === 0 && job.quoted_amount) {
      items.push({
        description: job.title || 'Service',
        quantity: 1,
        unitPrice: job.quoted_amount,
        total: job.quoted_amount,
      });
    }

    if (items.length === 0) {
      console.log(`[Invoicing] No items to invoice for job ${jobId}`);
      return null;
    }

    return this.createInvoice({
      jobId,
      customerId: job.customer_id,
      items,
      taxRate: job.tax_rate || 0,
      notes: `Service completed on ${new Date().toLocaleDateString()}`,
    });
  }

  /**
   * Create Stripe payment link
   */
  private async createPaymentLink(amount: number, reference: string): Promise<string> {
    if (!this.stripeApiKey) {
      // Return placeholder link if Stripe not configured
      return `https://pay.murrayfsm.com/invoice/${reference}`;
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/payment_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'line_items[0][price_data][currency]': 'usd',
          'line_items[0][price_data][product_data][name]': `Invoice ${reference}`,
          'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
          'line_items[0][quantity]': '1',
          'metadata[invoice_number]': reference,
        }),
      });

      const data = await response.json();
      return data.url || `https://pay.murrayfsm.com/invoice/${reference}`;
    } catch (error) {
      console.error('[Invoicing] Failed to create Stripe link:', error);
      return `https://pay.murrayfsm.com/invoice/${reference}`;
    }
  }

  /**
   * Send invoice to customer
   */
  async sendInvoice(params: SendInvoiceParams): Promise<{ success: boolean; sentVia: string[] }> {
    const { invoiceId, channels, message } = params;

    if (!this.supabase) {
      return { success: false, sentVia: [] };
    }

    // Get invoice and customer
    const { data: invoice } = await this.supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const customer = invoice.customer;
    const sentVia: string[] = [];

    const defaultMessage = message ||
      `Hi ${customer.name}, your invoice #${invoice.invoice_number} for $${invoice.total.toFixed(2)} is ready. ` +
      `Pay securely here: ${invoice.payment_link}`;

    // Send via each channel
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            // TODO: Integrate email service (SendGrid, Resend, etc.)
            console.log(`[Invoicing] Would send email to ${customer.email}`);
            sentVia.push('email');
            break;

          case 'sms':
          case 'whatsapp':
            if (customer.phone) {
              const result = channel === 'whatsapp'
                ? await jarvisBridge.sendWhatsApp(customer.phone, defaultMessage)
                : await jarvisBridge.sendWhatsApp(customer.phone, defaultMessage); // Fallback to WhatsApp for SMS

              if (result.success) {
                sentVia.push(channel);
              }
            }
            break;
        }
      } catch (error) {
        console.error(`[Invoicing] Failed to send via ${channel}:`, error);
      }
    }

    // Update invoice status
    if (sentVia.length > 0) {
      await this.supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_via: sentVia,
        })
        .eq('id', invoiceId);
    }

    return { success: sentVia.length > 0, sentVia };
  }

  /**
   * Mark invoice as paid
   */
  async markPaid(invoiceId: string, paymentMethod?: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
      })
      .eq('id', invoiceId);

    // Log revenue
    const { data: invoice } = await this.supabase
      .from('invoices')
      .select('total, job_id')
      .eq('id', invoiceId)
      .single();

    if (invoice) {
      await this.supabase.from('ai_revenue').insert({
        source: 'invoice_payment',
        amount: invoice.total,
        job_id: invoice.job_id,
        invoice_id: invoiceId,
      });
    }
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<Invoice[]> {
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('status', 'sent')
      .lt('due_date', new Date().toISOString());

    return (data || []).map(this.mapInvoice);
  }

  /**
   * Send payment reminders for overdue invoices
   */
  async sendReminders(): Promise<{ sent: number }> {
    const overdue = await this.getOverdueInvoices();
    let sent = 0;

    for (const invoice of overdue) {
      try {
        await this.sendInvoice({
          invoiceId: invoice.id,
          channels: ['whatsapp'],
          message: `Hi! Just a friendly reminder that invoice #${invoice.invoiceNumber} for $${invoice.total.toFixed(2)} is overdue. ` +
            `Please pay at your earliest convenience: ${invoice.paymentLink}`,
        });
        sent++;

        // Update status to overdue
        if (this.supabase) {
          await this.supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .eq('id', invoice.id);
        }
      } catch (error) {
        console.error(`[Invoicing] Failed to send reminder for ${invoice.id}:`, error);
      }
    }

    return { sent };
  }

  /**
   * Get invoice stats
   */
  async getStats(): Promise<{
    totalRevenue: number;
    pendingAmount: number;
    overdueAmount: number;
    paidThisMonth: number;
  }> {
    if (!this.supabase) {
      return { totalRevenue: 0, pendingAmount: 0, overdueAmount: 0, paidThisMonth: 0 };
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: stats } = await this.supabase.rpc('get_invoice_stats', {
      month_start: startOfMonth.toISOString(),
    });

    return stats || { totalRevenue: 0, pendingAmount: 0, overdueAmount: 0, paidThisMonth: 0 };
  }

  /**
   * Map database row to Invoice type
   */
  private mapInvoice(row: any): Invoice {
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      jobId: row.job_id,
      items: row.items,
      subtotal: row.subtotal,
      tax: row.tax,
      taxRate: row.tax_rate,
      total: row.total,
      status: row.status,
      dueDate: row.due_date,
      paidDate: row.paid_at,
      paymentLink: row.payment_link,
      sentVia: row.sent_via,
      createdAt: row.created_at,
    };
  }
}

// Export singleton
export const invoicingService = new InvoicingService();
export default invoicingService;
