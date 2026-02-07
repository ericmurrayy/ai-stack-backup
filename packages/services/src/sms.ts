/**
 * SMS Notification Service
 * ========================
 * Supports Twilio and MessageBird for SMS notifications
 */

export interface SMSConfig {
  provider: 'twilio' | 'messagebird';
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  fromNumber: string;
}

export interface SMSMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

// Normalize phone number to E.164 format
function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If it starts with 1 and has 11 digits, it's already US with country code
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }

  // If it has 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Otherwise return with + prefix
  return `+${digits}`;
}

// Twilio SMS provider
async function sendTwilio(config: SMSConfig, message: SMSMessage): Promise<SMSResult> {
  const { accountSid, authToken, fromNumber } = config;

  if (!accountSid || !authToken) {
    return { success: false, error: 'Twilio credentials not configured', provider: 'twilio' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams({
      To: normalizePhone(message.to),
      From: fromNumber,
      Body: message.body,
    });

    if (message.mediaUrl) {
      body.append('MediaUrl', message.mediaUrl);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
        provider: 'twilio',
      };
    }

    return {
      success: true,
      messageId: data.sid,
      provider: 'twilio',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send SMS via Twilio',
      provider: 'twilio',
    };
  }
}

// MessageBird SMS provider
async function sendMessageBird(config: SMSConfig, message: SMSMessage): Promise<SMSResult> {
  const { apiKey, fromNumber } = config;

  if (!apiKey) {
    return { success: false, error: 'MessageBird API key not configured', provider: 'messagebird' };
  }

  try {
    const response = await fetch('https://rest.messagebird.com/messages', {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originator: fromNumber,
        recipients: [normalizePhone(message.to)],
        body: message.body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.errors?.[0]?.description || `HTTP ${response.status}`,
        provider: 'messagebird',
      };
    }

    return {
      success: true,
      messageId: data.id,
      provider: 'messagebird',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send SMS via MessageBird',
      provider: 'messagebird',
    };
  }
}

// Create SMS service with configuration
export function createSMSService(config: SMSConfig) {
  return {
    /**
     * Send a single SMS message
     */
    async send(message: SMSMessage): Promise<SMSResult> {
      console.log(`[SMS] Sending to ${message.to} via ${config.provider}`);

      switch (config.provider) {
        case 'twilio':
          return sendTwilio(config, message);
        case 'messagebird':
          return sendMessageBird(config, message);
        default:
          return {
            success: false,
            error: `Unknown SMS provider: ${config.provider}`,
            provider: config.provider,
          };
      }
    },

    /**
     * Send SMS to multiple recipients
     */
    async sendBulk(messages: SMSMessage[]): Promise<SMSResult[]> {
      console.log(`[SMS] Sending bulk: ${messages.length} messages`);
      return Promise.all(messages.map(msg => this.send(msg)));
    },

    /**
     * Send job confirmation SMS
     */
    async sendJobConfirmation(phone: string, jobDetails: {
      jobNumber: string;
      date: string;
      time: string;
      technicianName?: string;
      address?: string;
    }): Promise<SMSResult> {
      const body = `✅ Job Confirmed: #${jobDetails.jobNumber}\n` +
        `📅 ${jobDetails.date} at ${jobDetails.time}\n` +
        (jobDetails.technicianName ? `👷 Tech: ${jobDetails.technicianName}\n` : '') +
        (jobDetails.address ? `📍 ${jobDetails.address}\n` : '') +
        `\n- Murray's Field Service`;

      return this.send({ to: phone, body });
    },

    /**
     * Send on-my-way notification
     */
    async sendOnMyWay(phone: string, details: {
      technicianName: string;
      eta: string;
    }): Promise<SMSResult> {
      const body = `🚗 ${details.technicianName} is on the way!\n` +
        `⏰ ETA: ${details.eta}\n` +
        `\n- Murray's Field Service`;

      return this.send({ to: phone, body });
    },

    /**
     * Send job complete notification
     */
    async sendJobComplete(phone: string, details: {
      jobNumber: string;
      total?: number;
      paymentLink?: string;
    }): Promise<SMSResult> {
      let body = `✅ Job #${details.jobNumber} Complete!\n\n`;

      if (details.total) {
        body += `💰 Total: $${details.total.toFixed(2)}\n`;
      }

      if (details.paymentLink) {
        body += `\n💳 Pay now: ${details.paymentLink}\n`;
      }

      body += `\nThank you for choosing Murray's Field Service!`;

      return this.send({ to: phone, body });
    },

    /**
     * Send payment reminder
     */
    async sendPaymentReminder(phone: string, details: {
      invoiceNumber: string;
      amount: number;
      dueDate: string;
      paymentLink: string;
      isOverdue?: boolean;
    }): Promise<SMSResult> {
      const body = details.isOverdue
        ? `⚠️ OVERDUE: Invoice #${details.invoiceNumber}\n` +
          `💰 Amount: $${details.amount.toFixed(2)}\n` +
          `📅 Due: ${details.dueDate}\n\n` +
          `Pay now: ${details.paymentLink}\n` +
          `\n- Murray's Field Service`
        : `📋 Reminder: Invoice #${details.invoiceNumber}\n` +
          `💰 Amount: $${details.amount.toFixed(2)}\n` +
          `📅 Due: ${details.dueDate}\n\n` +
          `Pay now: ${details.paymentLink}\n` +
          `\n- Murray's Field Service`;

      return this.send({ to: phone, body });
    },

    /**
     * Send review request
     */
    async sendReviewRequest(phone: string, details: {
      customerName: string;
      reviewLink: string;
    }): Promise<SMSResult> {
      const body = `Hi ${details.customerName}! 👋\n\n` +
        `How was your service? We'd love your feedback!\n\n` +
        `⭐ Leave a review: ${details.reviewLink}\n` +
        `\nThank you! - Murray's Field Service`;

      return this.send({ to: phone, body });
    },

    /**
     * Send appointment reminder
     */
    async sendAppointmentReminder(phone: string, details: {
      customerName: string;
      date: string;
      time: string;
      serviceType?: string;
    }): Promise<SMSResult> {
      const body = `Hi ${details.customerName}! 👋\n\n` +
        `Reminder: Your appointment is ${details.date} at ${details.time}\n` +
        (details.serviceType ? `Service: ${details.serviceType}\n` : '') +
        `\nReply CONFIRM or call if you need to reschedule.\n` +
        `\n- Murray's Field Service`;

      return this.send({ to: phone, body });
    },

    /**
     * Send quote notification
     */
    async sendQuoteNotification(phone: string, details: {
      quoteNumber: string;
      total: number;
      viewLink: string;
    }): Promise<SMSResult> {
      const body = `📋 Your Quote #${details.quoteNumber}\n\n` +
        `💰 Total: $${details.total.toFixed(2)}\n\n` +
        `View & accept: ${details.viewLink}\n` +
        `\n- Murray's Field Service`;

      return this.send({ to: phone, body });
    },
  };
}

// Default SMS service using environment variables
let defaultSMSService: ReturnType<typeof createSMSService> | null = null;

export function getSMSService() {
  if (!defaultSMSService) {
    const provider = (process.env.SMS_PROVIDER as 'twilio' | 'messagebird') || 'twilio';

    defaultSMSService = createSMSService({
      provider,
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      apiKey: process.env.MESSAGEBIRD_API_KEY,
      fromNumber: process.env.SMS_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '',
    });
  }

  return defaultSMSService;
}

export const smsService = {
  /**
   * Send SMS using default configuration
   */
  async send(to: string, body: string): Promise<SMSResult> {
    const service = getSMSService();
    return service.send({ to, body });
  },

  /**
   * Send job confirmation
   */
  async sendJobConfirmation(phone: string, jobDetails: Parameters<ReturnType<typeof createSMSService>['sendJobConfirmation']>[1]): Promise<SMSResult> {
    const service = getSMSService();
    return service.sendJobConfirmation(phone, jobDetails);
  },

  /**
   * Send on-my-way notification
   */
  async sendOnMyWay(phone: string, details: Parameters<ReturnType<typeof createSMSService>['sendOnMyWay']>[1]): Promise<SMSResult> {
    const service = getSMSService();
    return service.sendOnMyWay(phone, details);
  },

  /**
   * Send job complete notification
   */
  async sendJobComplete(phone: string, details: Parameters<ReturnType<typeof createSMSService>['sendJobComplete']>[1]): Promise<SMSResult> {
    const service = getSMSService();
    return service.sendJobComplete(phone, details);
  },

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(phone: string, details: Parameters<ReturnType<typeof createSMSService>['sendPaymentReminder']>[1]): Promise<SMSResult> {
    const service = getSMSService();
    return service.sendPaymentReminder(phone, details);
  },

  /**
   * Send review request
   */
  async sendReviewRequest(phone: string, details: Parameters<ReturnType<typeof createSMSService>['sendReviewRequest']>[1]): Promise<SMSResult> {
    const service = getSMSService();
    return service.sendReviewRequest(phone, details);
  },

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(phone: string, details: Parameters<ReturnType<typeof createSMSService>['sendAppointmentReminder']>[1]): Promise<SMSResult> {
    const service = getSMSService();
    return service.sendAppointmentReminder(phone, details);
  },

  /**
   * Send quote notification
   */
  async sendQuoteNotification(phone: string, details: Parameters<ReturnType<typeof createSMSService>['sendQuoteNotification']>[1]): Promise<SMSResult> {
    const service = getSMSService();
    return service.sendQuoteNotification(phone, details);
  },
};

export default smsService;
