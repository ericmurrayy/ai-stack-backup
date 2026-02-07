/**
 * Payment Reminders Service
 * =========================
 * Automated payment reminder system for overdue invoices
 */

import { createClient } from '@supabase/supabase-js';
import { createEmailService, type EmailConfig } from './email';
import { jarvisBridge } from './jarvis-bridge';

// Create email service instance lazily
function getEmailService() {
  const config: EmailConfig = {
    provider: (process.env.EMAIL_PROVIDER as 'resend' | 'sendgrid') || 'resend',
    apiKey: process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY,
    from: {
      email: process.env.FROM_EMAIL || 'noreply@murrayfsm.com',
      name: "Murray's Field Service",
    },
  };

  if (!config.apiKey) return null;
  return createEmailService(config);
}

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  total: number;
  due_date: string;
  payment_link?: string;
  reminder_count: number;
  last_reminder_at?: string;
  status: string;
}

interface ReminderResult {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  sentVia: string[];
  success: boolean;
  error?: string;
}

export const paymentRemindersService = {
  /**
   * Get overdue invoices that need reminders
   */
  async getOverdueInvoices(daysOverdue: number = 1): Promise<Invoice[]> {
    if (!supabase) return [];

    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysOverdue);

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .in('status', ['sent', 'viewed', 'overdue'])
      .lt('due_date', overdueDate.toISOString())
      .lt('reminder_count', 3) // Max 3 reminders
      .order('due_date', { ascending: true });

    if (error) {
      console.error('[PaymentReminders] Error fetching overdue invoices:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get invoices due soon (within X days)
   */
  async getInvoicesDueSoon(withinDays: number = 3): Promise<Invoice[]> {
    if (!supabase) return [];

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .in('status', ['sent', 'viewed'])
      .gte('due_date', now.toISOString())
      .lte('due_date', futureDate.toISOString())
      .eq('reminder_count', 0) // No reminders sent yet
      .order('due_date', { ascending: true });

    if (error) {
      console.error('[PaymentReminders] Error fetching invoices due soon:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Send payment reminder for an invoice
   */
  async sendReminder(invoice: Invoice, type: 'friendly' | 'overdue' | 'final' = 'friendly'): Promise<ReminderResult> {
    const result: ReminderResult = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      customerName: invoice.customer_name,
      sentVia: [],
      success: false,
    };

    try {
      const messages = this.getReminderMessages(invoice, type);
      const channels: string[] = [];

      // Send via email
      if (invoice.customer_email) {
        try {
          const emailSvc = getEmailService();
          if (emailSvc) {
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Invoice #${invoice.invoice_number}</h2>
                <p>Hi ${invoice.customer_name},</p>
                <p>${messages.emailBody}</p>
                ${invoice.payment_link ? `
                <p style="margin: 20px 0;">
                  <a href="${invoice.payment_link}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    Pay Now
                  </a>
                </p>
                ` : ''}
                <p>Thank you,<br>Murray's Field Service</p>
              </div>
            `;
            await emailSvc.send({
              to: invoice.customer_email,
              subject: messages.emailSubject,
              html: emailHtml,
              text: messages.emailBody,
            });
            channels.push('email');
          }
        } catch (emailError) {
          console.error('[PaymentReminders] Email send failed:', emailError);
        }
      }

      // Send via WhatsApp/SMS
      if (invoice.customer_phone) {
        try {
          await jarvisBridge.sendWhatsApp(invoice.customer_phone, messages.smsMessage);
          channels.push('whatsapp');
        } catch (whatsappError) {
          console.error('[PaymentReminders] WhatsApp send failed:', whatsappError);
        }
      }

      // Update invoice reminder count
      if (channels.length > 0 && supabase) {
        await supabase
          .from('invoices')
          .update({
            reminder_count: (invoice.reminder_count || 0) + 1,
            last_reminder_at: new Date().toISOString(),
            status: type === 'overdue' || type === 'final' ? 'overdue' : invoice.status,
          })
          .eq('id', invoice.id);

        // Log reminder
        await supabase.from('invoice_reminders').insert({
          invoice_id: invoice.id,
          reminder_type: type,
          channels: channels,
          sent_at: new Date().toISOString(),
        });
      }

      result.sentVia = channels;
      result.success = channels.length > 0;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  },

  /**
   * Get reminder message templates
   */
  getReminderMessages(invoice: Invoice, type: 'friendly' | 'overdue' | 'final') {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(invoice.total);

    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    switch (type) {
      case 'friendly':
        return {
          emailSubject: `Friendly Reminder: Invoice #${invoice.invoice_number} Due Soon`,
          emailBody: `This is a friendly reminder that your invoice for ${amount} is due on ${dueDate}. If you've already made the payment, please disregard this message.`,
          smsMessage: `Hi ${invoice.customer_name}, this is a friendly reminder that invoice #${invoice.invoice_number} for ${amount} is due ${dueDate}. Pay easily here: ${invoice.payment_link || 'contact us'} - Murray's Field Service`,
        };

      case 'overdue':
        return {
          emailSubject: `Payment Overdue: Invoice #${invoice.invoice_number}`,
          emailBody: `We noticed that your payment of ${amount} (Invoice #${invoice.invoice_number}) was due on ${dueDate} and remains unpaid. Please make your payment as soon as possible to avoid any service interruptions.`,
          smsMessage: `${invoice.customer_name}, your invoice #${invoice.invoice_number} for ${amount} is past due (was due ${dueDate}). Please pay at your earliest convenience: ${invoice.payment_link || 'contact us'} - Murray's`,
        };

      case 'final':
        return {
          emailSubject: `Final Notice: Invoice #${invoice.invoice_number} - Immediate Payment Required`,
          emailBody: `This is a final notice regarding your overdue payment of ${amount} (Invoice #${invoice.invoice_number}), originally due ${dueDate}. Please contact us immediately to resolve this matter and avoid any additional fees or service suspension.`,
          smsMessage: `FINAL NOTICE: ${invoice.customer_name}, invoice #${invoice.invoice_number} (${amount}) is significantly overdue. Please pay immediately or contact us: ${invoice.payment_link || 'call us'} - Murray's`,
        };
    }
  },

  /**
   * Process all pending reminders
   */
  async processAllReminders(): Promise<{
    dueSoon: ReminderResult[];
    overdue: ReminderResult[];
    final: ReminderResult[];
  }> {
    const results = {
      dueSoon: [] as ReminderResult[],
      overdue: [] as ReminderResult[],
      final: [] as ReminderResult[],
    };

    // Get invoices in different stages
    const [dueSoon, overdue7, overdue14] = await Promise.all([
      this.getInvoicesDueSoon(3),
      this.getOverdueInvoices(7),
      this.getOverdueInvoices(14),
    ]);

    // Send friendly reminders for invoices due soon
    for (const invoice of dueSoon) {
      const result = await this.sendReminder(invoice, 'friendly');
      results.dueSoon.push(result);
    }

    // Send overdue reminders (7+ days)
    for (const invoice of overdue7.filter(i => i.reminder_count < 2)) {
      const result = await this.sendReminder(invoice, 'overdue');
      results.overdue.push(result);
    }

    // Send final notices (14+ days)
    for (const invoice of overdue14.filter(i => i.reminder_count >= 2 && i.reminder_count < 3)) {
      const result = await this.sendReminder(invoice, 'final');
      results.final.push(result);
    }

    console.log('[PaymentReminders] Processing complete:', {
      dueSoon: results.dueSoon.length,
      overdue: results.overdue.length,
      final: results.final.length,
    });

    return results;
  },

  /**
   * Get reminder statistics
   */
  async getStats() {
    if (!supabase) {
      return {
        pendingReminders: 0,
        sentToday: 0,
        overdueCount: 0,
        overdueAmount: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [overdueResult, remindersTodayResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, total')
        .in('status', ['sent', 'viewed', 'overdue'])
        .lt('due_date', new Date().toISOString()),

      supabase
        .from('invoice_reminders')
        .select('id')
        .gte('sent_at', today.toISOString()),
    ]);

    const overdueInvoices = overdueResult.data || [];
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    return {
      pendingReminders: overdueInvoices.filter(i => (i as any).reminder_count < 3).length,
      sentToday: remindersTodayResult.data?.length || 0,
      overdueCount: overdueInvoices.length,
      overdueAmount,
    };
  },
};

export default paymentRemindersService;
