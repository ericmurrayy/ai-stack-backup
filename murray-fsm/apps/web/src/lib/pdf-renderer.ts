// Murray's FSM - PDF Renderer
// ============================
// Server-side PDF generation using jsPDF + jspdf-autotable
// Designed for Vercel/serverless (no Puppeteer dependency)

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EstimateData, InvoiceData, BusinessInfo } from '@murray-fsm/services';

// ============================================================================
// Brand Colors & Constants
// ============================================================================

/** Murray FSM primary blue */
const BRAND_BLUE: [number, number, number] = [37, 99, 235]; // #2563EB
/** Dark navy for headings */
const DARK_NAVY: [number, number, number] = [30, 40, 175]; // ~#1E28AF
/** Slate text color */
const TEXT_PRIMARY: [number, number, number] = [30, 41, 59]; // #1E293B
/** Muted text */
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // #64748B
/** Light muted text */
const TEXT_LIGHT: [number, number, number] = [148, 163, 184]; // #94A3B8
/** Table header background */
const TABLE_HEADER_BG: [number, number, number] = [241, 245, 249]; // #F1F5F9
/** Light background for sections */
const SECTION_BG: [number, number, number] = [248, 250, 252]; // #F8FAFC
/** Border color */
const BORDER_COLOR: [number, number, number] = [226, 232, 240]; // #E2E8F0
/** Amount due banner - amber */
const AMBER_BG: [number, number, number] = [254, 243, 199]; // #FEF3C7
const AMBER_BORDER: [number, number, number] = [245, 158, 11]; // #F59E0B
const AMBER_TEXT: [number, number, number] = [146, 64, 14]; // #92400E
/** Paid banner - green */
const GREEN_BG: [number, number, number] = [220, 252, 231]; // #DCFCE7
const GREEN_TEXT: [number, number, number] = [22, 101, 52]; // #166534

/** Page dimensions (US Letter in mm) */
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// ============================================================================
// Formatting Helpers (self-contained, no shared imports at build time)
// ============================================================================

function fmtCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function fmtDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const area = cleaned.slice(1, 4);
    const prefix = cleaned.slice(4, 7);
    const line = cleaned.slice(7);
    return `(${area}) ${prefix}-${line}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// ============================================================================
// Shared Document Builder
// ============================================================================

interface DrawContext {
  doc: jsPDF;
  y: number;
}

/**
 * Draw the company header block at the top of the document.
 * Returns the updated Y position.
 */
function drawHeader(
  ctx: DrawContext,
  business: BusinessInfo,
  docType: 'ESTIMATE' | 'INVOICE',
  docNumber: string
): number {
  const { doc } = ctx;
  let y = ctx.y;

  // ---- Left side: business info ----
  // Business name
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_BLUE);
  doc.text(business.name, MARGIN_LEFT, y);

  // Business address and contact
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTED);

  const addressLine = `${business.address1}${business.address2 ? `, ${business.address2}` : ''}`;
  doc.text(addressLine, MARGIN_LEFT, y);
  y += 4;

  const cityLine = `${business.city}, ${business.state} ${business.postalCode}`;
  doc.text(cityLine, MARGIN_LEFT, y);
  y += 4;

  let contactLine = fmtPhone(business.phone);
  if (business.email) contactLine += `  |  ${business.email}`;
  doc.text(contactLine, MARGIN_LEFT, y);
  y += 4;

  if (business.website) {
    doc.text(business.website, MARGIN_LEFT, y);
    y += 4;
  }
  if (business.licenseNumber) {
    doc.text(`License: ${business.licenseNumber}`, MARGIN_LEFT, y);
    y += 4;
  }

  // ---- Right side: document type and number ----
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  const headerTopY = ctx.y;

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_BLUE);
  doc.text(docType, rightX, headerTopY, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`#${docNumber}`, rightX, headerTopY + 9, { align: 'right' });

  // Ensure y is below both columns
  y = Math.max(y, headerTopY + 16);

  // Divider line
  y += 4;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 8;

  return y;
}

/**
 * Draw a three-column info section (dates, customer, location).
 */
function drawInfoSection(
  ctx: DrawContext,
  dateSection: { label1: string; value1: string; label2?: string; value2?: string },
  customer: { name: string; phone?: string; email?: string },
  location: { address1: string; address2?: string; city: string; state: string; postal_code: string }
): number {
  const { doc } = ctx;
  let y = ctx.y;
  const colWidth = CONTENT_WIDTH / 3;
  const col1X = MARGIN_LEFT;
  const col2X = MARGIN_LEFT + colWidth;
  const col3X = MARGIN_LEFT + colWidth * 2;

  // Helper to draw a label + value pair
  const drawField = (x: number, yPos: number, label: string, value: string): number => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(label.toUpperCase(), x, yPos);
    yPos += 4.5;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(value, x, yPos);
    yPos += 5;

    return yPos;
  };

  const drawDetail = (x: number, yPos: number, text: string): number => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(text, x, yPos);
    return yPos + 4;
  };

  // Column 1: Dates
  let y1 = drawField(col1X, y, dateSection.label1, dateSection.value1);
  if (dateSection.label2 && dateSection.value2) {
    y1 += 3;
    y1 = drawField(col1X, y1, dateSection.label2, dateSection.value2);
  }

  // Column 2: Customer
  let y2 = drawField(col2X, y, customer.name ? 'Customer' : 'Bill To', customer.name);
  if (customer.phone) y2 = drawDetail(col2X, y2, fmtPhone(customer.phone));
  if (customer.email) y2 = drawDetail(col2X, y2, customer.email);

  // Column 3: Location
  let y3 = drawField(col3X, y, 'Service Location', location.address1);
  if (location.address2) y3 = drawDetail(col3X, y3, location.address2);
  y3 = drawDetail(col3X, y3, `${location.city}, ${location.state} ${location.postal_code}`);

  y = Math.max(y1, y2, y3) + 6;
  return y;
}

/**
 * Draw the job title/description block with a light background.
 */
function drawJobSection(
  ctx: DrawContext,
  title: string,
  description?: string
): number {
  const { doc } = ctx;
  let y = ctx.y;

  // Background rectangle
  const blockHeight = description ? 18 : 12;
  doc.setFillColor(...SECTION_BG);
  doc.roundedRect(MARGIN_LEFT, y - 3, CONTENT_WIDTH, blockHeight, 2, 2, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(title, MARGIN_LEFT + 6, y + 4);

  if (description) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    // Truncate long descriptions to fit
    const maxWidth = CONTENT_WIDTH - 12;
    const lines = doc.splitTextToSize(description, maxWidth);
    doc.text(lines.slice(0, 2), MARGIN_LEFT + 6, y + 10);
  }

  y += blockHeight + 6;
  return y;
}

/**
 * Draw the line items table using jspdf-autotable.
 * Returns the Y position after the table.
 */
function drawLineItemsTable(
  ctx: DrawContext,
  lineItems: Array<{
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
  }>
): number {
  const { doc } = ctx;

  const tableData = lineItems.map((item) => [
    item.description,
    item.quantity.toString(),
    fmtCents(item.unit_price_cents),
    fmtCents(item.total_cents),
  ]);

  autoTable(doc, {
    startY: ctx.y,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'plain',
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
      textColor: TEXT_PRIMARY,
      lineColor: BORDER_COLOR,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: TABLE_HEADER_BG,
      textColor: TEXT_MUTED,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    didParseCell(data) {
      // Right-align header cells for numeric columns
      if (data.section === 'head' && data.column.index >= 1) {
        data.cell.styles.halign = data.column.index === 1 ? 'center' : 'right';
      }
    },
  });

  // jspdf-autotable sets doc.lastAutoTable with info about the rendered table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? ctx.y + 20;
  return finalY + 6;
}

/**
 * Draw the totals section (subtotal, tax, total, payment info).
 */
function drawTotalsSection(
  ctx: DrawContext,
  subtotal: number,
  taxRate?: number,
  taxAmount?: number,
  total?: number,
  amountPaid?: number
): number {
  const { doc } = ctx;
  let y = ctx.y;

  const totalValue = total ?? subtotal + (taxAmount ?? 0);
  const amountDue = totalValue - (amountPaid ?? 0);

  // Right-aligned totals box
  const boxWidth = 100;
  const boxX = PAGE_WIDTH - MARGIN_RIGHT - boxWidth;
  const valueX = PAGE_WIDTH - MARGIN_RIGHT - 4;
  const labelX = boxX + 4;
  const rowHeight = 7;

  const drawRow = (
    label: string,
    value: string,
    opts?: {
      bold?: boolean;
      textColor?: [number, number, number];
      bgColor?: [number, number, number];
      fontSize?: number;
      borderBottom?: [number, number, number];
    }
  ): void => {
    if (opts?.bgColor) {
      doc.setFillColor(...opts.bgColor);
      doc.roundedRect(boxX, y - 1, boxWidth, rowHeight + 1, 1, 1, 'F');
    }

    const color = opts?.textColor ?? TEXT_MUTED;
    const size = opts?.fontSize ?? 9;

    doc.setFontSize(size);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(label, labelX, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.text(value, valueX, y + 4, { align: 'right' });

    if (opts?.borderBottom) {
      doc.setDrawColor(...opts.borderBottom);
      doc.setLineWidth(0.4);
      doc.line(boxX, y + rowHeight, boxX + boxWidth, y + rowHeight);
    }

    y += rowHeight + 1;
  };

  // Subtotal
  drawRow('Subtotal', fmtCents(subtotal), { borderBottom: BORDER_COLOR });

  // Tax
  if (taxRate && taxAmount) {
    drawRow(`Tax (${taxRate}%)`, fmtCents(taxAmount), { borderBottom: BORDER_COLOR });
  }

  // Total
  drawRow('Total', fmtCents(totalValue), {
    bold: true,
    textColor: BRAND_BLUE,
    fontSize: 11,
    borderBottom: BRAND_BLUE,
  });

  // Payment history (invoices only)
  if (amountPaid != null && amountPaid > 0) {
    y += 2;
    drawRow('Amount Paid', `-${fmtCents(amountPaid)}`, { borderBottom: BORDER_COLOR });
    drawRow('Amount Due', fmtCents(amountDue), {
      bold: true,
      textColor: AMBER_TEXT,
      bgColor: AMBER_BG,
      fontSize: 10,
    });
  }

  return y + 4;
}

/**
 * Draw an "Amount Due" or "Paid in Full" banner.
 */
function drawAmountDueBanner(ctx: DrawContext, amountDue: number): number {
  const { doc } = ctx;
  let y = ctx.y;

  const bannerHeight = 14;

  if (amountDue > 0) {
    // Amber "Amount Due" banner
    doc.setFillColor(...AMBER_BG);
    doc.setDrawColor(...AMBER_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, bannerHeight, 2, 2, 'FD');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...AMBER_TEXT);
    doc.text('Amount Due:', MARGIN_LEFT + 8, y + 9);

    doc.setFontSize(16);
    doc.text(fmtCents(amountDue), PAGE_WIDTH - MARGIN_RIGHT - 8, y + 10, { align: 'right' });
  } else {
    // Green "Paid in Full" banner
    doc.setFillColor(...GREEN_BG);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, bannerHeight, 2, 2, 'FD');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN_TEXT);
    doc.text('PAID IN FULL', PAGE_WIDTH / 2, y + 9.5, { align: 'center' });
  }

  y += bannerHeight + 6;
  return y;
}

/**
 * Draw a labeled text section (notes, terms, payment instructions).
 */
function drawTextSection(
  ctx: DrawContext,
  label: string,
  content: string
): number {
  const { doc } = ctx;
  let y = ctx.y;

  // Wrap text for available width
  const maxWidth = CONTENT_WIDTH - 16;
  const lines: string[] = doc.splitTextToSize(content, maxWidth);
  const blockHeight = Math.max(14, 10 + lines.length * 4);

  // Check if we need a page break
  if (y + blockHeight > PAGE_HEIGHT - 30) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  // Background
  doc.setFillColor(...SECTION_BG);
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, blockHeight, 2, 2, 'F');

  // Label
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_MUTED);
  doc.text(label.toUpperCase(), MARGIN_LEFT + 6, y + 5);

  // Content
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(lines, MARGIN_LEFT + 6, y + 10);

  y += blockHeight + 5;
  return y;
}

/**
 * Draw the footer at the bottom of the last page.
 */
function drawFooter(doc: jsPDF, business: BusinessInfo): void {
  const footerY = PAGE_HEIGHT - 18;

  // Top border
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, footerY, PAGE_WIDTH - MARGIN_RIGHT, footerY);

  // "Thank you for your business!"
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_BLUE);
  doc.text('Thank you for your business!', PAGE_WIDTH / 2, footerY + 6, { align: 'center' });

  // Contact line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_LIGHT);
  const contactLine = `${business.name}  |  ${fmtPhone(business.phone)}  |  ${business.email}`;
  doc.text(contactLine, PAGE_WIDTH / 2, footerY + 11, { align: 'center' });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Render a professional estimate PDF.
 *
 * @param business - Company/business information
 * @param estimate - Estimate data (line items, customer, totals, etc.)
 * @returns Uint8Array containing the PDF binary data
 */
export function renderEstimatePdf(
  business: BusinessInfo,
  estimate: EstimateData
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const ctx: DrawContext = { doc, y: MARGIN_TOP };

  // Header
  ctx.y = drawHeader(ctx, business, 'ESTIMATE', estimate.estimateNumber);

  // Info section (date + valid until, customer, location)
  ctx.y = drawInfoSection(
    ctx,
    {
      label1: 'Date',
      value1: fmtDate(estimate.date),
      label2: estimate.validUntil ? 'Valid Until' : undefined,
      value2: estimate.validUntil ? fmtDate(estimate.validUntil) : undefined,
    },
    {
      name: estimate.customer.name,
      phone: estimate.customer.phone,
      email: estimate.customer.email,
    },
    estimate.location
  );

  // Job title / description
  ctx.y = drawJobSection(ctx, estimate.jobTitle, estimate.jobDescription);

  // Line items table
  ctx.y = drawLineItemsTable(ctx, estimate.lineItems);

  // Totals
  ctx.y = drawTotalsSection(ctx, estimate.subtotal, estimate.taxRate, estimate.taxAmount, estimate.total);

  // Notes
  if (estimate.notes) {
    ctx.y = drawTextSection(ctx, 'Notes', estimate.notes);
  }

  // Terms & Conditions
  if (estimate.terms) {
    ctx.y = drawTextSection(ctx, 'Terms & Conditions', estimate.terms);
  }

  // Footer
  drawFooter(doc, business);

  // Return as Uint8Array
  return doc.output('arraybuffer') as unknown as Uint8Array;
}

/**
 * Render a professional invoice PDF.
 *
 * @param business - Company/business information
 * @param invoice - Invoice data (line items, customer, totals, payments, etc.)
 * @returns Uint8Array containing the PDF binary data
 */
export function renderInvoicePdf(
  business: BusinessInfo,
  invoice: InvoiceData
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const ctx: DrawContext = { doc, y: MARGIN_TOP };

  // Header
  ctx.y = drawHeader(ctx, business, 'INVOICE', invoice.invoiceNumber);

  // Info section (dates, customer, location)
  ctx.y = drawInfoSection(
    ctx,
    {
      label1: 'Invoice Date',
      value1: fmtDate(invoice.date),
      label2: invoice.dueDate ? 'Due Date' : undefined,
      value2: invoice.dueDate ? fmtDate(invoice.dueDate) : undefined,
    },
    {
      name: invoice.customer.name,
      phone: invoice.customer.phone,
      email: invoice.customer.email,
    },
    invoice.location
  );

  // Amount Due / Paid banner
  const amountDue = invoice.amountDue ?? (invoice.total - (invoice.amountPaid ?? 0));
  ctx.y = drawAmountDueBanner(ctx, amountDue);

  // Job title / description
  ctx.y = drawJobSection(ctx, invoice.jobTitle, invoice.jobDescription);

  // Line items table
  ctx.y = drawLineItemsTable(ctx, invoice.lineItems);

  // Totals (with payment info)
  ctx.y = drawTotalsSection(
    ctx,
    invoice.subtotal,
    invoice.taxRate,
    invoice.taxAmount,
    invoice.total,
    invoice.amountPaid
  );

  // Payment instructions
  if (invoice.paymentInstructions) {
    ctx.y = drawTextSection(ctx, 'Payment Instructions', invoice.paymentInstructions);
  }

  // Notes
  if (invoice.notes) {
    ctx.y = drawTextSection(ctx, 'Notes', invoice.notes);
  }

  // Terms & Conditions
  if (invoice.terms) {
    ctx.y = drawTextSection(ctx, 'Terms & Conditions', invoice.terms);
  }

  // Footer
  drawFooter(doc, business);

  // Return as Uint8Array
  return doc.output('arraybuffer') as unknown as Uint8Array;
}
