/**
 * Email Templates Service
 * =======================
 * Automated email templates for Murray's FSM
 */

export interface TemplateVariables {
  // Customer
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Job
  jobNumber?: string;
  jobDate?: string;
  jobTime?: string;
  jobAddress?: string;
  serviceType?: string;
  technicianName?: string;

  // Financial
  amount?: number;
  invoiceNumber?: string;
  quoteNumber?: string;
  dueDate?: string;
  paymentLink?: string;

  // Reviews
  reviewLink?: string;

  // Business
  businessName?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessAddress?: string;

  // Custom
  [key: string]: string | number | undefined;
}

// Compile template by replacing {{variable}} placeholders
function compileTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') {
      // Format currency if it looks like an amount
      if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total')) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      }
      return value.toString();
    }
    return value;
  });
}

// Base email wrapper
function wrapInEmailLayout(content: string, variables: TemplateVariables): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Murray's Field Service</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 24px; font-weight: bold; color: #ffffff;">Murray's</div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.8);">Field Service</div>
                  </td>
                  <td align="right" style="color: rgba(255,255,255,0.9); font-size: 14px;">
                    ${variables.businessPhone || '(555) 123-4567'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size: 12px; color: #64748b;">
                    <p style="margin: 0;">Murray's Field Service</p>
                    <p style="margin: 5px 0 0 0;">${variables.businessAddress || '123 Business St, Austin TX 78701'}</p>
                    <p style="margin: 5px 0 0 0;">Licensed & Insured</p>
                  </td>
                  <td align="right" style="font-size: 12px; color: #64748b;">
                    <p style="margin: 0;">Questions?</p>
                    <p style="margin: 5px 0 0 0;">Call ${variables.businessPhone || '(555) 123-4567'}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Email Templates
export const emailTemplates = {
  /**
   * Job Confirmation Email
   */
  jobConfirmation: {
    subject: 'Your Service Appointment is Confirmed - Job #{{jobNumber}}',
    html: (vars: TemplateVariables) => wrapInEmailLayout(`
      <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #1e293b;">Appointment Confirmed! ✓</h1>

      <p style="margin: 0 0 20px 0; font-size: 16px; color: #475569;">
        Hi ${vars.customerName || 'there'},
      </p>

      <p style="margin: 0 0 30px 0; font-size: 16px; color: #475569;">
        Your service appointment has been confirmed. Here are the details:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 30px;">
        <tr>
          <td style="padding: 25px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Job Number:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">#${vars.jobNumber || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${vars.jobDate || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${vars.jobTime || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Service:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${vars.serviceType || 'General Service'}</td>
              </tr>
              ${vars.technicianName ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Technician:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${vars.technicianName}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Location:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${vars.jobAddress || ''}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">
        Need to reschedule? Call us at ${vars.businessPhone || '(555) 123-4567'}
      </p>
    `, vars),
    text: (vars: TemplateVariables) => compileTemplate(`
Appointment Confirmed!

Hi {{customerName}},

Your service appointment has been confirmed.

Job Number: #{{jobNumber}}
Date: {{jobDate}}
Time: {{jobTime}}
Service: {{serviceType}}
Location: {{jobAddress}}

Need to reschedule? Call us at {{businessPhone}}

- Murray's Field Service
    `, vars),
  },

  /**
   * On My Way Notification
   */
  onMyWay: {
    subject: 'Your Technician is On the Way! 🚗',
    html: (vars: TemplateVariables) => wrapInEmailLayout(`
      <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #1e293b;">On the Way! 🚗</h1>

      <p style="margin: 0 0 20px 0; font-size: 16px; color: #475569;">
        Hi ${vars.customerName || 'there'},
      </p>

      <p style="margin: 0 0 30px 0; font-size: 16px; color: #475569;">
        <strong>${vars.technicianName || 'Your technician'}</strong> is on the way to your location and should arrive soon!
      </p>

      <div style="background-color: #dbeafe; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: 600;">
          📍 Heading to: ${vars.jobAddress || 'your location'}
        </p>
      </div>

      <p style="margin: 0; font-size: 14px; color: #64748b;">
        If you need to reach your technician, please call our office at ${vars.businessPhone || '(555) 123-4567'}
      </p>
    `, vars),
    text: (vars: TemplateVariables) => compileTemplate(`
On the Way!

Hi {{customerName}},

{{technicianName}} is on the way to your location and should arrive soon!

Heading to: {{jobAddress}}

If you need to reach your technician, please call our office at {{businessPhone}}

- Murray's Field Service
    `, vars),
  },

  /**
   * Invoice Email
   */
  invoice: {
    subject: 'Invoice #{{invoiceNumber}} from Murray\'s Field Service',
    html: (vars: TemplateVariables) => wrapInEmailLayout(`
      <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #1e293b;">Invoice #${vars.invoiceNumber}</h1>

      <p style="margin: 0 0 20px 0; font-size: 16px; color: #475569;">
        Hi ${vars.customerName || 'there'},
      </p>

      <p style="margin: 0 0 30px 0; font-size: 16px; color: #475569;">
        Thank you for choosing Murray's Field Service. Please find your invoice details below:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 30px;">
        <tr>
          <td style="padding: 25px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice Number:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">#${vars.invoiceNumber || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Job Number:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">#${vars.jobNumber || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Due Date:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${vars.dueDate || 'Upon receipt'}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 15px; border-top: 1px solid #e2e8f0;"></td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #1e293b; font-size: 18px; font-weight: 700;">Amount Due:</td>
                <td style="padding: 12px 0; color: #16a34a; font-weight: 700; font-size: 24px;">$${(vars.amount || 0).toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${vars.paymentLink ? `
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${vars.paymentLink}" style="display: inline-block; padding: 16px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Pay Now →
        </a>
      </div>
      ` : ''}

      <p style="margin: 0; font-size: 14px; color: #64748b; text-align: center;">
        Questions about this invoice? Call us at ${vars.businessPhone || '(555) 123-4567'}
      </p>
    `, vars),
    text: (vars: TemplateVariables) => compileTemplate(`
Invoice #{{invoiceNumber}}

Hi {{customerName}},

Thank you for choosing Murray's Field Service. Please find your invoice details below:

Invoice Number: #{{invoiceNumber}}
Job Number: #{{jobNumber}}
Due Date: {{dueDate}}
Amount Due: {{amount}}

Pay online: {{paymentLink}}

Questions? Call us at {{businessPhone}}

- Murray's Field Service
    `, vars),
  },

  /**
   * Payment Received
   */
  paymentReceived: {
    subject: 'Payment Received - Thank You! 💚',
    html: (vars: TemplateVariables) => wrapInEmailLayout(`
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 80px; height: 80px; background-color: #dcfce7; border-radius: 50%; line-height: 80px;">
          <span style="font-size: 40px;">✓</span>
        </div>
      </div>

      <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #1e293b; text-align: center;">Payment Received!</h1>

      <p style="margin: 0 0 30px 0; font-size: 16px; color: #475569; text-align: center;">
        Hi ${vars.customerName || 'there'}, we've received your payment of <strong>$${(vars.amount || 0).toFixed(2)}</strong>.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 30px;">
        <tr>
          <td style="padding: 25px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice Number:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">#${vars.invoiceNumber || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Amount Paid:</td>
                <td style="padding: 8px 0; color: #16a34a; font-weight: 600; font-size: 14px;">$${(vars.amount || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Status:</td>
                <td style="padding: 8px 0; color: #16a34a; font-weight: 600; font-size: 14px;">PAID ✓</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 16px; color: #475569; text-align: center;">
        Thank you for your business! We appreciate you choosing Murray's Field Service.
      </p>
    `, vars),
    text: (vars: TemplateVariables) => compileTemplate(`
Payment Received!

Hi {{customerName}},

We've received your payment of {{amount}}.

Invoice Number: #{{invoiceNumber}}
Amount Paid: {{amount}}
Status: PAID

Thank you for your business!

- Murray's Field Service
    `, vars),
  },

  /**
   * Review Request
   */
  reviewRequest: {
    subject: 'How was your service? We\'d love your feedback! ⭐',
    html: (vars: TemplateVariables) => wrapInEmailLayout(`
      <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #1e293b; text-align: center;">How was your service?</h1>

      <p style="margin: 0 0 20px 0; font-size: 16px; color: #475569;">
        Hi ${vars.customerName || 'there'},
      </p>

      <p style="margin: 0 0 30px 0; font-size: 16px; color: #475569;">
        Thank you for choosing Murray's Field Service! We hope you were satisfied with our work.
        Your feedback helps us improve and helps other customers find quality service.
      </p>

      <div style="text-align: center; margin-bottom: 30px;">
        <p style="font-size: 40px; margin: 0 0 20px 0;">⭐⭐⭐⭐⭐</p>
        <a href="${vars.reviewLink || '#'}" style="display: inline-block; padding: 16px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Leave a Review →
        </a>
      </div>

      <p style="margin: 0; font-size: 14px; color: #64748b; text-align: center;">
        It only takes a minute and means a lot to our team!
      </p>
    `, vars),
    text: (vars: TemplateVariables) => compileTemplate(`
How was your service?

Hi {{customerName}},

Thank you for choosing Murray's Field Service! We hope you were satisfied with our work.

Your feedback helps us improve and helps other customers find quality service.

Leave a review: {{reviewLink}}

It only takes a minute and means a lot to our team!

- Murray's Field Service
    `, vars),
  },

  /**
   * Quote Email
   */
  quote: {
    subject: 'Your Quote #{{quoteNumber}} from Murray\'s Field Service',
    html: (vars: TemplateVariables) => wrapInEmailLayout(`
      <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #1e293b;">Your Quote</h1>

      <p style="margin: 0 0 20px 0; font-size: 16px; color: #475569;">
        Hi ${vars.customerName || 'there'},
      </p>

      <p style="margin: 0 0 30px 0; font-size: 16px; color: #475569;">
        Thank you for your interest in Murray's Field Service. Here's your quote:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 30px;">
        <tr>
          <td style="padding: 25px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Quote Number:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">#${vars.quoteNumber || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Service:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${vars.serviceType || 'General Service'}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 15px; border-top: 1px solid #e2e8f0;"></td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #1e293b; font-size: 18px; font-weight: 700;">Total:</td>
                <td style="padding: 12px 0; color: #1e293b; font-weight: 700; font-size: 24px;">$${(vars.amount || 0).toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${vars.paymentLink || '#'}" style="display: inline-block; padding: 16px 40px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Accept & Schedule →
        </a>
      </div>

      <p style="margin: 0; font-size: 14px; color: #64748b; text-align: center;">
        This quote is valid for 30 days. Questions? Call ${vars.businessPhone || '(555) 123-4567'}
      </p>
    `, vars),
    text: (vars: TemplateVariables) => compileTemplate(`
Your Quote

Hi {{customerName}},

Thank you for your interest in Murray's Field Service. Here's your quote:

Quote Number: #{{quoteNumber}}
Service: {{serviceType}}
Total: {{amount}}

View and accept online: {{paymentLink}}

This quote is valid for 30 days.

Questions? Call {{businessPhone}}

- Murray's Field Service
    `, vars),
  },

  /**
   * Payment Reminder
   */
  paymentReminder: {
    subject: 'Reminder: Invoice #{{invoiceNumber}} Due {{dueDate}}',
    html: (vars: TemplateVariables) => wrapInEmailLayout(`
      <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #1e293b;">Payment Reminder</h1>

      <p style="margin: 0 0 20px 0; font-size: 16px; color: #475569;">
        Hi ${vars.customerName || 'there'},
      </p>

      <p style="margin: 0 0 30px 0; font-size: 16px; color: #475569;">
        This is a friendly reminder that your invoice is due soon. Please see details below:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; margin-bottom: 30px;">
        <tr>
          <td style="padding: 25px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Invoice Number:</td>
                <td style="padding: 8px 0; color: #78350f; font-weight: 600; font-size: 14px;">#${vars.invoiceNumber || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Due Date:</td>
                <td style="padding: 8px 0; color: #78350f; font-weight: 600; font-size: 14px;">${vars.dueDate || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Amount Due:</td>
                <td style="padding: 8px 0; color: #78350f; font-weight: 700; font-size: 20px;">$${(vars.amount || 0).toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${vars.paymentLink ? `
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${vars.paymentLink}" style="display: inline-block; padding: 16px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Pay Now →
        </a>
      </div>
      ` : ''}

      <p style="margin: 0; font-size: 14px; color: #64748b; text-align: center;">
        If you've already made this payment, please disregard this reminder.
      </p>
    `, vars),
    text: (vars: TemplateVariables) => compileTemplate(`
Payment Reminder

Hi {{customerName}},

This is a friendly reminder that your invoice is due soon.

Invoice Number: #{{invoiceNumber}}
Due Date: {{dueDate}}
Amount Due: {{amount}}

Pay online: {{paymentLink}}

If you've already made this payment, please disregard this reminder.

- Murray's Field Service
    `, vars),
  },
};

// Export template names for easy reference
export type TemplateNames = keyof typeof emailTemplates;

// Helper to get all available templates
export function getAvailableTemplates(): TemplateNames[] {
  return Object.keys(emailTemplates) as TemplateNames[];
}

// Generate email content from template
export function generateEmail(
  templateName: TemplateNames,
  variables: TemplateVariables
): { subject: string; html: string; text: string } {
  const template = emailTemplates[templateName];

  return {
    subject: compileTemplate(template.subject, variables),
    html: template.html(variables),
    text: template.text(variables),
  };
}

export default emailTemplates;
