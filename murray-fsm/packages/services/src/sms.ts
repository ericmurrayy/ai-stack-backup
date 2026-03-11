// Murray's FSM - SMS Service
// ===========================
// Provider-agnostic SMS service with support for Twilio and OpenPhone

// ============================================================================
// Types
// ============================================================================

export type SmsProviderType = 'twilio' | 'openphone';

export interface SmsConfig {
  provider: SmsProviderType;
  /** Twilio Account SID (required for twilio provider) */
  accountSid?: string;
  /** Twilio Auth Token (required for twilio provider) */
  authToken?: string;
  /** Twilio phone number to send from, E.164 format (required for twilio) */
  fromNumber?: string;
  /** OpenPhone API key (required for openphone provider) */
  apiKey?: string;
  /** OpenPhone phone number resource ID (required for openphone) */
  phoneNumberId?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface SmsProvider {
  /**
   * Send an SMS (or MMS if mediaUrl is provided) to the given phone number.
   * @param to - Destination phone number in E.164 format (e.g. +15551234567)
   * @param body - Message text (max ~1600 chars for SMS, varies by provider)
   * @param mediaUrl - Optional URL to an image/media file for MMS
   */
  sendSms(to: string, body: string, mediaUrl?: string): Promise<SmsResult>;
}

// ============================================================================
// Twilio Provider
// ============================================================================

class TwilioProvider implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;

  constructor(config: SmsConfig) {
    if (!config.accountSid) {
      throw new Error('Twilio accountSid is required');
    }
    if (!config.authToken) {
      throw new Error('Twilio authToken is required');
    }
    if (!config.fromNumber) {
      throw new Error('Twilio fromNumber is required');
    }
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
  }

  async sendSms(to: string, body: string, mediaUrl?: string): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const params = new URLSearchParams({
      To: to,
      From: this.fromNumber,
      Body: body,
    });

    if (mediaUrl) {
      params.append('MediaUrl', mediaUrl);
    }

    // Twilio uses HTTP Basic Auth: accountSid:authToken
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await res.json() as { message?: string; code?: string; sid?: string };

      if (!res.ok) {
        return {
          success: false,
          error: data.message || `Twilio error: ${res.status} ${data.code || ''}`.trim(),
        };
      }

      return {
        success: true,
        messageId: data.sid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send SMS via Twilio',
      };
    }
  }
}

// ============================================================================
// OpenPhone Provider
// ============================================================================

class OpenPhoneProvider implements SmsProvider {
  private readonly apiKey: string;
  private readonly phoneNumberId: string;

  constructor(config: SmsConfig) {
    if (!config.apiKey) {
      throw new Error('OpenPhone apiKey is required');
    }
    if (!config.phoneNumberId) {
      throw new Error('OpenPhone phoneNumberId is required');
    }
    this.apiKey = config.apiKey;
    this.phoneNumberId = config.phoneNumberId;
  }

  async sendSms(to: string, body: string, mediaUrl?: string): Promise<SmsResult> {
    const url = 'https://api.openphone.com/v1/messages';

    const payload: Record<string, unknown> = {
      from: this.phoneNumberId,
      to: [to],
      content: body,
    };

    if (mediaUrl) {
      payload.media = [{ url: mediaUrl }];
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as { error?: { message?: string }; message?: string; data?: { id?: string }; id?: string };

      if (!res.ok) {
        const errMsg = data.error?.message
          || data.message
          || `OpenPhone error: ${res.status}`;
        return {
          success: false,
          error: errMsg,
        };
      }

      // OpenPhone returns the created message object
      const messageId = data.data?.id || data.id || undefined;

      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send SMS via OpenPhone',
      };
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an SMS service instance for the configured provider.
 *
 * @example
 * ```ts
 * const sms = createSmsService({
 *   provider: 'twilio',
 *   accountSid: process.env.TWILIO_ACCOUNT_SID,
 *   authToken: process.env.TWILIO_AUTH_TOKEN,
 *   fromNumber: process.env.TWILIO_FROM_NUMBER,
 * });
 *
 * const result = await sms.sendSms('+15551234567', 'Hello from Murray FSM!');
 * ```
 */
export function createSmsService(config: SmsConfig): SmsProvider {
  switch (config.provider) {
    case 'twilio':
      return new TwilioProvider(config);
    case 'openphone':
      return new OpenPhoneProvider(config);
    default:
      throw new Error(`Unsupported SMS provider: ${config.provider}`);
  }
}

// ============================================================================
// SMS Templates
// ============================================================================

/**
 * Build an appointment confirmation SMS body.
 *
 * @param customerName - First name or full name of the customer
 * @param date - Human-readable date string (e.g. "Monday, March 15")
 * @param time - Human-readable time string (e.g. "2:00 PM")
 * @param businessName - Name of the business
 */
export function buildAppointmentConfirmationSms(
  customerName: string,
  date: string,
  time: string,
  businessName: string,
): string {
  return (
    `Hi ${customerName}, your appointment with ${businessName} is confirmed for ${date} at ${time}. ` +
    `We'll send you a notification when our technician is on the way. ` +
    `Reply STOP to unsubscribe.`
  );
}

/**
 * Build an "en route" notification SMS body.
 *
 * @param customerName - First name or full name of the customer
 * @param technicianName - Name of the technician heading to the job
 * @param eta - Estimated time of arrival (e.g. "15 minutes" or "2:30 PM")
 */
export function buildEnRouteSms(
  customerName: string,
  technicianName: string,
  eta: string,
): string {
  return (
    `Hi ${customerName}, ${technicianName} is on the way and should arrive in approximately ${eta}. ` +
    `Please ensure access to the service area. ` +
    `Reply STOP to unsubscribe.`
  );
}

/**
 * Build an invoice / payment request SMS body.
 *
 * @param customerName - First name or full name of the customer
 * @param amount - Formatted dollar amount (e.g. "$350.00")
 * @param paymentUrl - URL where the customer can pay online
 */
export function buildInvoiceSms(
  customerName: string,
  amount: string,
  paymentUrl: string,
): string {
  return (
    `Hi ${customerName}, your invoice for ${amount} is ready. ` +
    `Pay securely online: ${paymentUrl} ` +
    `Reply STOP to unsubscribe.`
  );
}

/**
 * Build a review request SMS body.
 *
 * @param customerName - First name or full name of the customer
 * @param reviewUrl - URL where the customer can leave a review
 */
export function buildReviewRequestSms(
  customerName: string,
  reviewUrl: string,
): string {
  return (
    `Hi ${customerName}, thank you for choosing us! We'd love your feedback. ` +
    `Please leave a quick review: ${reviewUrl} ` +
    `Reply STOP to unsubscribe.`
  );
}

// ============================================================================
// Template Registry (for API route dynamic dispatch)
// ============================================================================

export type SmsTemplateName =
  | 'appointment_confirmation'
  | 'en_route'
  | 'invoice'
  | 'review_request';

export interface AppointmentConfirmationData {
  customerName: string;
  date: string;
  time: string;
  businessName: string;
}

export interface EnRouteData {
  customerName: string;
  technicianName: string;
  eta: string;
}

export interface SmsInvoiceData {
  customerName: string;
  amount: string;
  paymentUrl: string;
}

export interface ReviewRequestData {
  customerName: string;
  reviewUrl: string;
}

export type SmsTemplateData =
  | AppointmentConfirmationData
  | EnRouteData
  | SmsInvoiceData
  | ReviewRequestData;

/**
 * Build an SMS body from a named template and its data.
 * Returns null if the template name is not recognized or data is invalid.
 */
export function buildSmsFromTemplate(
  template: SmsTemplateName,
  data: Record<string, unknown>,
): string | null {
  switch (template) {
    case 'appointment_confirmation': {
      const { customerName, date, time, businessName } = data as Record<string, string>;
      if (!customerName || !date || !time || !businessName) return null;
      return buildAppointmentConfirmationSms(customerName, date, time, businessName);
    }
    case 'en_route': {
      const { customerName, technicianName, eta } = data as Record<string, string>;
      if (!customerName || !technicianName || !eta) return null;
      return buildEnRouteSms(customerName, technicianName, eta);
    }
    case 'invoice': {
      const { customerName, amount, paymentUrl } = data as Record<string, string>;
      if (!customerName || !amount || !paymentUrl) return null;
      return buildInvoiceSms(customerName, amount, paymentUrl);
    }
    case 'review_request': {
      const { customerName, reviewUrl } = data as Record<string, string>;
      if (!customerName || !reviewUrl) return null;
      return buildReviewRequestSms(customerName, reviewUrl);
    }
    default:
      return null;
  }
}
