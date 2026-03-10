// Murray's FSM - Email Service
// =============================
// Provider-agnostic email service with support for multiple providers

import { formatCents, formatDate, formatPhone } from '@murray-fsm/shared';

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Types
// ============================================================================

export type EmailProvider = 'sendgrid' | 'resend' | 'postmark' | 'ses' | 'smtp';

export interface EmailConfig {
  provider: EmailProvider;
  apiKey?: string;
  from: {
    email: string;
    name: string;
  };
  replyTo?: string;
  // Provider-specific config
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  awsRegion?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Email Templates
// ============================================================================

export interface EstimateEmailData {
  customerName: string;
  businessName: string;
  estimateNumber: string;
  jobTitle: string;
  total: number;
  validUntil?: string;
  estimateUrl: string;
  businessPhone: string;
}

export interface InvoiceEmailData {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  jobTitle: string;
  total: number;
  amountDue: number;
  dueDate?: string;
  invoiceUrl: string;
  paymentUrl?: string;
  businessPhone: string;
}

export interface AppointmentEmailData {
  customerName: string;
  businessName: string;
  jobTitle: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  technicianName?: string;
  businessPhone: string;
  confirmationUrl?: string;
}

export interface PaymentReceiptData {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  jobTitle: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  receiptUrl?: string;
  businessPhone: string;
}

// ============================================================================
// Email Template Generator
// ============================================================================

/**
 * Generate estimate email HTML
 */
export function generateEstimateEmail(data: EstimateEmailData): { subject: string; html: string; text: string } {
  const subject = `Estimate #${escapeHtml(data.estimateNumber)} from ${escapeHtml(data.businessName)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1e40af; color: #ffffff; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; margin-bottom: 16px; }
    .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; }
    .detail-value { font-weight: 600; }
    .total-row { font-size: 18px; color: #1e40af; }
    .cta-button { display: inline-block; background: #1e40af; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { background: #f8fafc; padding: 24px 32px; text-align: center; font-size: 14px; color: #64748b; }
    .footer a { color: #1e40af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.businessName)}</h1>
    </div>
    <div class="content">
      <p class="greeting">Hi ${escapeHtml(data.customerName)},</p>
      <p>Thank you for requesting an estimate! Here's a summary of the work we discussed:</p>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Estimate #</span>
          <span class="detail-value">${escapeHtml(data.estimateNumber)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${escapeHtml(data.jobTitle)}</span>
        </div>
        <div class="detail-row total-row">
          <span class="detail-label">Estimated Total</span>
          <span class="detail-value">${formatCents(data.total)}</span>
        </div>
        ${data.validUntil ? `
        <div class="detail-row">
          <span class="detail-label">Valid Until</span>
          <span class="detail-value">${formatDate(data.validUntil)}</span>
        </div>
        ` : ''}
      </div>

      <p style="text-align: center;">
        <a href="${data.estimateUrl}" class="cta-button">View Full Estimate</a>
      </p>

      <p>If you have any questions or would like to schedule the work, please don't hesitate to reach out!</p>

      <p>Best regards,<br>${escapeHtml(data.businessName)}</p>
    </div>
    <div class="footer">
      <p>Questions? Call us at <a href="tel:${data.businessPhone}">${formatPhone(data.businessPhone)}</a></p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Hi ${escapeHtml(data.customerName)},

Thank you for requesting an estimate! Here's a summary:

Estimate #: ${escapeHtml(data.estimateNumber)}
Service: ${escapeHtml(data.jobTitle)}
Estimated Total: ${formatCents(data.total)}
${data.validUntil ? `Valid Until: ${formatDate(data.validUntil)}` : ''}

View your full estimate here: ${data.estimateUrl}

Questions? Call us at ${formatPhone(data.businessPhone)}

Best regards,
${escapeHtml(data.businessName)}
`;

  return { subject, html, text };
}

/**
 * Generate invoice email HTML
 */
export function generateInvoiceEmail(data: InvoiceEmailData): { subject: string; html: string; text: string } {
  const subject = `Invoice #${escapeHtml(data.invoiceNumber)} from ${escapeHtml(data.businessName)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1e40af; color: #ffffff; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .amount-due { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center; }
    .amount-due-label { font-size: 14px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; }
    .amount-due-value { font-size: 36px; font-weight: 700; color: #92400e; }
    .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; }
    .detail-value { font-weight: 600; }
    .cta-button { display: inline-block; background: #22c55e; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .secondary-button { display: inline-block; background: #e2e8f0; color: #1e293b !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 8px; }
    .footer { background: #f8fafc; padding: 24px 32px; text-align: center; font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.businessName)}</h1>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(data.customerName)},</p>
      <p>Thank you for choosing us! Please find your invoice below:</p>

      <div class="amount-due">
        <div class="amount-due-label">Amount Due</div>
        <div class="amount-due-value">${formatCents(data.amountDue)}</div>
        ${data.dueDate ? `<div style="color: #92400e; font-size: 14px; margin-top: 8px;">Due by ${formatDate(data.dueDate)}</div>` : ''}
      </div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Invoice #</span>
          <span class="detail-value">${escapeHtml(data.invoiceNumber)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${escapeHtml(data.jobTitle)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total</span>
          <span class="detail-value">${formatCents(data.total)}</span>
        </div>
      </div>

      <p style="text-align: center;">
        ${data.paymentUrl ? `<a href="${data.paymentUrl}" class="cta-button">Pay Now</a><br>` : ''}
        <a href="${data.invoiceUrl}" class="secondary-button">View Invoice</a>
      </p>

      <p>Thank you for your business!</p>

      <p>Best regards,<br>${escapeHtml(data.businessName)}</p>
    </div>
    <div class="footer">
      <p>Questions? Call us at <a href="tel:${data.businessPhone}">${formatPhone(data.businessPhone)}</a></p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Hi ${escapeHtml(data.customerName)},

Thank you for choosing us! Please find your invoice below:

Invoice #: ${escapeHtml(data.invoiceNumber)}
Service: ${escapeHtml(data.jobTitle)}
Total: ${formatCents(data.total)}
Amount Due: ${formatCents(data.amountDue)}
${data.dueDate ? `Due By: ${formatDate(data.dueDate)}` : ''}

${data.paymentUrl ? `Pay Now: ${data.paymentUrl}` : ''}
View Invoice: ${data.invoiceUrl}

Questions? Call us at ${formatPhone(data.businessPhone)}

Best regards,
${escapeHtml(data.businessName)}
`;

  return { subject, html, text };
}

/**
 * Generate appointment confirmation email
 */
export function generateAppointmentEmail(data: AppointmentEmailData): { subject: string; html: string; text: string } {
  const subject = `Appointment Confirmed: ${escapeHtml(data.jobTitle)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1e40af; color: #ffffff; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .confirmation-badge { background: #dcfce7; color: #166534; display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 24px; }
    .appointment-card { background: #f8fafc; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #1e40af; }
    .appointment-date { font-size: 24px; font-weight: 700; color: #1e40af; }
    .appointment-time { font-size: 18px; color: #64748b; }
    .appointment-service { font-size: 16px; margin-top: 16px; }
    .appointment-address { color: #64748b; margin-top: 8px; }
    .footer { background: #f8fafc; padding: 24px 32px; text-align: center; font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.businessName)}</h1>
    </div>
    <div class="content">
      <span class="confirmation-badge">Appointment Confirmed</span>

      <p>Hi ${escapeHtml(data.customerName)},</p>
      <p>Your appointment has been scheduled!</p>

      <div class="appointment-card">
        <div class="appointment-date">${escapeHtml(data.scheduledDate)}</div>
        <div class="appointment-time">${escapeHtml(data.scheduledTime)}</div>
        <div class="appointment-service"><strong>${escapeHtml(data.jobTitle)}</strong></div>
        <div class="appointment-address">${escapeHtml(data.address)}</div>
        ${data.technicianName ? `<div style="margin-top: 16px; color: #64748b;">Your technician: <strong>${escapeHtml(data.technicianName)}</strong></div>` : ''}
      </div>

      <p><strong>What to expect:</strong></p>
      <ul>
        <li>We'll send a reminder the day before your appointment</li>
        <li>Our technician will call when they're on the way</li>
        <li>Please ensure access to the service area</li>
      </ul>

      <p>Need to reschedule? Call us at <a href="tel:${data.businessPhone}">${formatPhone(data.businessPhone)}</a></p>

      <p>Thank you for choosing ${escapeHtml(data.businessName)}!</p>
    </div>
    <div class="footer">
      <p>Questions? Call us at <a href="tel:${data.businessPhone}">${formatPhone(data.businessPhone)}</a></p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
APPOINTMENT CONFIRMED

Hi ${escapeHtml(data.customerName)},

Your appointment has been scheduled!

Date: ${escapeHtml(data.scheduledDate)}
Time: ${escapeHtml(data.scheduledTime)}
Service: ${escapeHtml(data.jobTitle)}
Location: ${escapeHtml(data.address)}
${data.technicianName ? `Technician: ${escapeHtml(data.technicianName)}` : ''}

What to expect:
- We'll send a reminder the day before your appointment
- Our technician will call when they're on the way
- Please ensure access to the service area

Need to reschedule? Call us at ${formatPhone(data.businessPhone)}

Thank you for choosing ${escapeHtml(data.businessName)}!
`;

  return { subject, html, text };
}

/**
 * Generate payment receipt email
 */
export function generatePaymentReceiptEmail(data: PaymentReceiptData): { subject: string; html: string; text: string } {
  const subject = `Payment Receipt from ${escapeHtml(data.businessName)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #22c55e; color: #ffffff; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .receipt-badge { background: #dcfce7; color: #166534; display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 24px; }
    .amount-paid { font-size: 36px; font-weight: 700; color: #22c55e; text-align: center; margin: 24px 0; }
    .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; }
    .detail-value { font-weight: 600; }
    .footer { background: #f8fafc; padding: 24px 32px; text-align: center; font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Received</h1>
    </div>
    <div class="content">
      <span class="receipt-badge">Thank You!</span>

      <p>Hi ${escapeHtml(data.customerName)},</p>
      <p>We've received your payment. Here's your receipt:</p>

      <div class="amount-paid">${formatCents(data.amountPaid)}</div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Invoice #</span>
          <span class="detail-value">${escapeHtml(data.invoiceNumber)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${escapeHtml(data.jobTitle)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Date</span>
          <span class="detail-value">${formatDate(data.paymentDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Method</span>
          <span class="detail-value">${escapeHtml(data.paymentMethod)}</span>
        </div>
      </div>

      <p>Thank you for your business! We appreciate you choosing ${escapeHtml(data.businessName)}.</p>

      <p>Best regards,<br>${escapeHtml(data.businessName)}</p>
    </div>
    <div class="footer">
      <p>Questions? Call us at <a href="tel:${data.businessPhone}">${formatPhone(data.businessPhone)}</a></p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
PAYMENT RECEIVED

Hi ${escapeHtml(data.customerName)},

We've received your payment. Here's your receipt:

Amount Paid: ${formatCents(data.amountPaid)}
Invoice #: ${escapeHtml(data.invoiceNumber)}
Service: ${escapeHtml(data.jobTitle)}
Payment Date: ${formatDate(data.paymentDate)}
Payment Method: ${escapeHtml(data.paymentMethod)}

Thank you for your business!

Best regards,
${escapeHtml(data.businessName)}

Questions? Call us at ${formatPhone(data.businessPhone)}
`;

  return { subject, html, text };
}

// ============================================================================
// Email Sending Interface
// ============================================================================

/**
 * Create email service with provider configuration
 * Returns functions for sending different types of emails
 */
export function createEmailService(config: EmailConfig) {
  // This is the interface - actual sending would be done by provider-specific implementation
  // In Next.js API routes or Edge Functions

  return {
    /**
     * Send a raw email
     */
    async send(message: EmailMessage): Promise<EmailResult> {
      // Implementation would use provider SDK
      // For now, return structure for API route implementation
      return {
        success: false,
        error: 'Email sending must be implemented in API route with provider SDK',
      };
    },

    /**
     * Send estimate email
     */
    async sendEstimate(to: string, data: EstimateEmailData): Promise<EmailResult> {
      const { subject, html, text } = generateEstimateEmail(data);
      return this.send({ to, subject, html, text });
    },

    /**
     * Send invoice email
     */
    async sendInvoice(to: string, data: InvoiceEmailData): Promise<EmailResult> {
      const { subject, html, text } = generateInvoiceEmail(data);
      return this.send({ to, subject, html, text });
    },

    /**
     * Send appointment confirmation
     */
    async sendAppointmentConfirmation(to: string, data: AppointmentEmailData): Promise<EmailResult> {
      const { subject, html, text } = generateAppointmentEmail(data);
      return this.send({ to, subject, html, text });
    },

    /**
     * Send payment receipt
     */
    async sendPaymentReceipt(to: string, data: PaymentReceiptData): Promise<EmailResult> {
      const { subject, html, text } = generatePaymentReceiptEmail(data);
      return this.send({ to, subject, html, text });
    },
  };
}
