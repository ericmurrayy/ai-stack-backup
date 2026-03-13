// Murray's FSM - PDF Generation Service
// ======================================
// Generate PDFs for estimates and invoices

import { formatCents, formatDate, formatPhone, formatAddress } from '@murray-fsm/shared';

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

export interface BusinessInfo {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  licenseNumber?: string;
}

export interface LineItemData {
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

export interface CustomerData {
  name: string;
  phone?: string;
  email?: string;
}

export interface LocationData {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postal_code: string;
}

export interface EstimateData {
  estimateNumber: string;
  date: string;
  validUntil?: string;
  customer: CustomerData;
  location: LocationData;
  jobTitle: string;
  jobDescription?: string;
  lineItems: LineItemData[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  notes?: string;
  terms?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  customer: CustomerData;
  location: LocationData;
  jobTitle: string;
  jobDescription?: string;
  lineItems: LineItemData[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
}

// ============================================================================
// HTML Template Generation
// ============================================================================

/**
 * Generate HTML template for estimate
 * This HTML can be converted to PDF using a service like Puppeteer or html-pdf
 */
export function generateEstimateHTML(
  business: BusinessInfo,
  estimate: EstimateData
): string {
  const styles = getDocumentStyles();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Estimate ${estimate.estimateNumber}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="document">
    ${generateHeader(business, 'ESTIMATE', estimate.estimateNumber)}

    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Date</div>
        <div class="info-value">${formatDate(estimate.date)}</div>
        ${estimate.validUntil ? `
        <div class="info-label" style="margin-top: 8px;">Valid Until</div>
        <div class="info-value">${formatDate(estimate.validUntil)}</div>
        ` : ''}
      </div>

      <div class="info-block">
        <div class="info-label">Customer</div>
        <div class="info-value">${escapeHtml(estimate.customer.name)}</div>
        ${estimate.customer.phone ? `<div class="info-detail">${formatPhone(estimate.customer.phone)}</div>` : ''}
        ${estimate.customer.email ? `<div class="info-detail">${estimate.customer.email}</div>` : ''}
      </div>

      <div class="info-block">
        <div class="info-label">Service Location</div>
        <div class="info-value">${escapeHtml(estimate.location.address1)}</div>
        ${estimate.location.address2 ? `<div class="info-detail">${escapeHtml(estimate.location.address2)}</div>` : ''}
        <div class="info-detail">${escapeHtml(estimate.location.city)}, ${escapeHtml(estimate.location.state)} ${escapeHtml(estimate.location.postal_code)}</div>
      </div>
    </div>

    <div class="job-section">
      <div class="job-title">${escapeHtml(estimate.jobTitle)}</div>
      ${estimate.jobDescription ? `<div class="job-description">${escapeHtml(estimate.jobDescription)}</div>` : ''}
    </div>

    ${generateLineItemsTable(estimate.lineItems)}

    ${generateTotalsSection(estimate.subtotal, estimate.taxRate, estimate.taxAmount, estimate.total)}

    ${estimate.notes ? `
    <div class="notes-section">
      <div class="notes-label">Notes</div>
      <div class="notes-content">${escapeHtml(estimate.notes)}</div>
    </div>
    ` : ''}

    ${estimate.terms ? `
    <div class="terms-section">
      <div class="terms-label">Terms & Conditions</div>
      <div class="terms-content">${escapeHtml(estimate.terms)}</div>
    </div>
    ` : ''}

    ${generateFooter(business)}
  </div>
</body>
</html>
`;
}

/**
 * Generate HTML template for invoice
 */
export function generateInvoiceHTML(
  business: BusinessInfo,
  invoice: InvoiceData
): string {
  const styles = getDocumentStyles();
  const amountDue = invoice.amountDue ?? (invoice.total - (invoice.amountPaid ?? 0));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="document">
    ${generateHeader(business, 'INVOICE', invoice.invoiceNumber)}

    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Invoice Date</div>
        <div class="info-value">${formatDate(invoice.date)}</div>
        ${invoice.dueDate ? `
        <div class="info-label" style="margin-top: 8px;">Due Date</div>
        <div class="info-value">${formatDate(invoice.dueDate)}</div>
        ` : ''}
      </div>

      <div class="info-block">
        <div class="info-label">Bill To</div>
        <div class="info-value">${escapeHtml(invoice.customer.name)}</div>
        ${invoice.customer.phone ? `<div class="info-detail">${formatPhone(invoice.customer.phone)}</div>` : ''}
        ${invoice.customer.email ? `<div class="info-detail">${invoice.customer.email}</div>` : ''}
      </div>

      <div class="info-block">
        <div class="info-label">Service Location</div>
        <div class="info-value">${escapeHtml(invoice.location.address1)}</div>
        ${invoice.location.address2 ? `<div class="info-detail">${escapeHtml(invoice.location.address2)}</div>` : ''}
        <div class="info-detail">${escapeHtml(invoice.location.city)}, ${escapeHtml(invoice.location.state)} ${escapeHtml(invoice.location.postal_code)}</div>
      </div>
    </div>

    ${amountDue > 0 ? `
    <div class="amount-due-banner">
      <span>Amount Due:</span>
      <span class="amount">${formatCents(amountDue)}</span>
    </div>
    ` : `
    <div class="paid-banner">
      <span>PAID IN FULL</span>
    </div>
    `}

    <div class="job-section">
      <div class="job-title">${escapeHtml(invoice.jobTitle)}</div>
      ${invoice.jobDescription ? `<div class="job-description">${escapeHtml(invoice.jobDescription)}</div>` : ''}
    </div>

    ${generateLineItemsTable(invoice.lineItems)}

    ${generateTotalsSection(invoice.subtotal, invoice.taxRate, invoice.taxAmount, invoice.total, invoice.amountPaid)}

    ${invoice.paymentInstructions ? `
    <div class="payment-section">
      <div class="payment-label">Payment Instructions</div>
      <div class="payment-content">${escapeHtml(invoice.paymentInstructions)}</div>
    </div>
    ` : ''}

    ${invoice.notes ? `
    <div class="notes-section">
      <div class="notes-label">Notes</div>
      <div class="notes-content">${escapeHtml(invoice.notes)}</div>
    </div>
    ` : ''}

    ${invoice.terms ? `
    <div class="terms-section">
      <div class="terms-label">Terms & Conditions</div>
      <div class="terms-content">${escapeHtml(invoice.terms)}</div>
    </div>
    ` : ''}

    ${generateFooter(business)}
  </div>
</body>
</html>
`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateHeader(business: BusinessInfo, docType: string, docNumber: string): string {
  return `
    <div class="header">
      <div class="business-info">
        ${business.logo ? `<img src="${business.logo}" alt="${escapeHtml(business.name)}" class="logo" />` : ''}
        <div class="business-name">${escapeHtml(business.name)}</div>
        <div class="business-details">
          ${escapeHtml(business.address1)}${business.address2 ? `, ${escapeHtml(business.address2)}` : ''}<br>
          ${escapeHtml(business.city)}, ${escapeHtml(business.state)} ${escapeHtml(business.postalCode)}<br>
          ${formatPhone(business.phone)}
          ${business.email ? ` | ${business.email}` : ''}
          ${business.website ? `<br>${escapeHtml(business.website)}` : ''}
          ${business.licenseNumber ? `<br>License: ${escapeHtml(business.licenseNumber)}` : ''}
        </div>
      </div>
      <div class="doc-info">
        <div class="doc-type">${docType}</div>
        <div class="doc-number">#${docNumber}</div>
      </div>
    </div>
  `;
}

function generateLineItemsTable(lineItems: LineItemData[]): string {
  const rows = lineItems.map(item => `
    <tr>
      <td class="item-desc">${escapeHtml(item.description)}</td>
      <td class="item-qty">${item.quantity}</td>
      <td class="item-price">${formatCents(item.unit_price_cents)}</td>
      <td class="item-total">${formatCents(item.total_cents)}</td>
    </tr>
  `).join('');

  return `
    <table class="line-items">
      <thead>
        <tr>
          <th class="item-desc">Description</th>
          <th class="item-qty">Qty</th>
          <th class="item-price">Unit Price</th>
          <th class="item-total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function generateTotalsSection(
  subtotal: number,
  taxRate?: number,
  taxAmount?: number,
  total?: number,
  amountPaid?: number
): string {
  const totalValue = total ?? subtotal + (taxAmount ?? 0);
  const amountDue = totalValue - (amountPaid ?? 0);

  return `
    <div class="totals-section">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">${formatCents(subtotal)}</span>
      </div>
      ${taxRate && taxAmount ? `
      <div class="totals-row">
        <span class="totals-label">Tax (${taxRate}%)</span>
        <span class="totals-value">${formatCents(taxAmount)}</span>
      </div>
      ` : ''}
      <div class="totals-row total-row">
        <span class="totals-label">Total</span>
        <span class="totals-value">${formatCents(totalValue)}</span>
      </div>
      ${amountPaid && amountPaid > 0 ? `
      <div class="totals-row">
        <span class="totals-label">Amount Paid</span>
        <span class="totals-value">-${formatCents(amountPaid)}</span>
      </div>
      <div class="totals-row amount-due-row">
        <span class="totals-label">Amount Due</span>
        <span class="totals-value">${formatCents(amountDue)}</span>
      </div>
      ` : ''}
    </div>
  `;
}

function generateFooter(business: BusinessInfo): string {
  return `
    <div class="footer">
      <div class="footer-text">Thank you for your business!</div>
      <div class="footer-contact">${escapeHtml(business.name)} | ${formatPhone(business.phone)} | ${business.email}</div>
    </div>
  `;
}

function getDocumentStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.5; }
    .document { max-width: 800px; margin: 0 auto; padding: 40px; }

    .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .business-info { flex: 1; }
    .logo { max-width: 200px; max-height: 60px; margin-bottom: 10px; }
    .business-name { font-size: 24px; font-weight: 700; color: #1e40af; margin-bottom: 8px; }
    .business-details { font-size: 11px; color: #64748b; line-height: 1.6; }
    .doc-info { text-align: right; }
    .doc-type { font-size: 28px; font-weight: 700; color: #1e40af; letter-spacing: 2px; }
    .doc-number { font-size: 14px; color: #64748b; margin-top: 4px; }

    .info-section { display: flex; gap: 40px; margin-bottom: 30px; }
    .info-block { flex: 1; }
    .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
    .info-value { font-size: 14px; font-weight: 600; color: #1e293b; }
    .info-detail { font-size: 12px; color: #64748b; }

    .amount-due-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .amount-due-banner span { font-size: 14px; font-weight: 600; color: #92400e; }
    .amount-due-banner .amount { font-size: 24px; }
    .paid-banner { background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 16px 24px; margin-bottom: 30px; text-align: center; }
    .paid-banner span { font-size: 18px; font-weight: 700; color: #166534; letter-spacing: 2px; }

    .job-section { margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
    .job-title { font-size: 16px; font-weight: 600; color: #1e293b; }
    .job-description { font-size: 12px; color: #64748b; margin-top: 8px; }

    .line-items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .line-items th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .line-items td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .line-items .item-desc { width: 50%; }
    .line-items .item-qty { width: 15%; text-align: center; }
    .line-items .item-price, .line-items .item-total { width: 17.5%; text-align: right; }
    .line-items th.item-qty, .line-items th.item-price, .line-items th.item-total { text-align: right; }

    .totals-section { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .totals-label { color: #64748b; }
    .totals-value { font-weight: 600; }
    .total-row { border-bottom: 2px solid #1e40af; }
    .total-row .totals-label, .total-row .totals-value { font-size: 16px; color: #1e40af; }
    .amount-due-row { background: #fef3c7; margin: 8px -8px 0; padding: 12px 8px; border-radius: 4px; border: none; }
    .amount-due-row .totals-label, .amount-due-row .totals-value { color: #92400e; font-size: 14px; }

    .notes-section, .terms-section, .payment-section { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
    .notes-label, .terms-label, .payment-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
    .notes-content, .terms-content, .payment-content { font-size: 11px; color: #475569; white-space: pre-wrap; }

    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer-text { font-size: 14px; font-weight: 600; color: #1e40af; margin-bottom: 8px; }
    .footer-contact { font-size: 11px; color: #94a3b8; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .document { max-width: none; padding: 0; }
    }
  `;
}

// ============================================================================
// URL Generation for PDF Endpoints
// ============================================================================

/**
 * Generate URL for estimate PDF endpoint
 * Use with Next.js API route or Edge Function
 */
export function getEstimatePdfUrl(jobId: string, baseUrl: string): string {
  return `${baseUrl}/api/pdf/estimate/${jobId}`;
}

/**
 * Generate URL for invoice PDF endpoint
 * Use with Next.js API route or Edge Function
 */
export function getInvoicePdfUrl(jobId: string, baseUrl: string): string {
  return `${baseUrl}/api/pdf/invoice/${jobId}`;
}
