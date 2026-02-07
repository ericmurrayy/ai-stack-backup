# Murray's FSM - AI-Powered Revenue Features

## Overview

This document describes the comprehensive AI-powered revenue generation and optimization features built into Murray's Field Service Management system. These features work together to automate customer interactions, optimize pricing, streamline payments, and maximize revenue.

---

## Table of Contents

1. [Phone AI Integration](#phone-ai-integration)
2. [AI Quote Generation](#ai-quote-generation)
3. [Automated Invoicing](#automated-invoicing)
4. [Payment Processing](#payment-processing)
5. [Review Management](#review-management)
6. [Analytics Dashboard](#analytics-dashboard)
7. [Settings & Configuration](#settings--configuration)
8. [API Reference](#api-reference)

---

## Phone AI Integration

### Overview
AI-powered phone answering using Retell AI that can handle customer calls 24/7, book appointments, and create jobs automatically.

### Features
- **24/7 Availability**: Never miss a customer call
- **Automatic Job Creation**: Creates jobs from call information
- **Call Recording & Transcription**: Full records of all conversations
- **Sentiment Analysis**: Track customer satisfaction
- **Call Analytics**: Monitor conversion rates and call patterns

### Components
- `packages/services/src/retell.ts` - Retell AI integration service
- `apps/web/src/app/api/phone/route.ts` - Phone API endpoint
- `apps/web/src/app/api/phone/webhook/route.ts` - Retell webhook handler
- `apps/web/src/components/phone/CallLog.tsx` - Call history UI
- `apps/web/src/app/(dashboard)/phone/page.tsx` - Phone dashboard

### Configuration
```env
RETELL_API_KEY=your_api_key
RETELL_AGENT_ID=your_agent_id
RETELL_WEBHOOK_SECRET=your_webhook_secret
```

### Usage
1. Enable Phone AI in Settings > AI Features
2. Configure your Retell agent with business-specific prompts
3. Forward your business line to the Retell number
4. Monitor calls in the Phone dashboard

---

## AI Quote Generation

### Overview
Intelligent quote generation that suggests pricing based on service type, customer history, and market conditions.

### Features
- **AI Pricing Suggestions**: Uses Ollama/local LLM for pricing recommendations
- **Service Catalog Integration**: Pre-defined pricing for common services
- **Customer History Awareness**: Adjusts pricing based on customer relationship
- **One-Click Quote Sending**: Send via email or WhatsApp
- **Quote Tracking**: Monitor viewed, accepted, and expired quotes

### Components
- `packages/services/src/quoting.ts` - Quote generation service
- `apps/web/src/app/api/quotes/route.ts` - Quotes API
- `apps/web/src/app/(dashboard)/quotes/page.tsx` - Quotes dashboard
- `apps/web/src/app/quote/[id]/page.tsx` - Customer-facing quote view

### Quote Workflow
1. Customer calls or requests service
2. AI generates quote with suggested pricing
3. Quote sent to customer via preferred channel
4. Customer views quote (tracked)
5. Customer accepts quote with optional scheduling
6. Job automatically created from accepted quote

### API Example
```typescript
// Generate AI-powered quote
const quote = await quotingService.generateQuote({
  customerId: 'cust_123',
  jobDescription: 'AC unit not cooling, needs repair',
  services: [
    { service: 'Diagnostic Fee', quantity: 1 },
    { service: 'AC Repair', quantity: 1 }
  ]
});

// Send quote to customer
await quotingService.sendQuote(quote.id, ['email', 'whatsapp']);
```

---

## Automated Invoicing

### Overview
Automatic invoice generation when jobs are completed, with integrated payment links and multiple delivery options.

### Features
- **Auto-Generation**: Invoices created automatically on job completion
- **Stripe Payment Links**: One-click payment for customers
- **Multi-Channel Delivery**: Send via email, SMS, or WhatsApp
- **Payment Tracking**: Monitor invoice status in real-time
- **Overdue Alerts**: Automatic reminders for unpaid invoices

### Components
- `packages/services/src/invoicing.ts` - Invoice service
- `apps/web/src/app/api/invoices/route.ts` - Invoice API
- `apps/web/src/app/(dashboard)/invoices/page.tsx` - Invoice dashboard
- `apps/web/src/app/invoice/[id]/page.tsx` - Customer-facing invoice view
- `apps/web/src/app/api/webhooks/stripe/route.ts` - Payment webhook

### Invoice Workflow
1. Job marked as completed
2. Invoice automatically generated with line items
3. Stripe payment link created
4. Invoice sent to customer
5. Customer pays via link
6. Payment confirmed via webhook
7. Thank you message sent automatically

### Configuration
```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Payment Processing

### Overview
Seamless payment processing with Stripe integration, supporting multiple payment methods and automatic reconciliation.

### Features
- **Stripe Checkout**: Secure, hosted payment pages
- **Multiple Payment Methods**: Cards, ACH, Apple Pay, Google Pay
- **Automatic Reconciliation**: Payments matched to invoices
- **Payment History**: Complete transaction records
- **Refund Support**: Process refunds when needed

### Webhook Events Handled
- `checkout.session.completed` - Payment link used
- `payment_intent.succeeded` - Direct payment completed
- `payment_intent.payment_failed` - Payment failed
- `invoice.paid` - Stripe invoice paid

---

## Review Management

### Overview
Automated review request system to build online reputation after successful job completion.

### Features
- **Automatic Review Requests**: Sent after job completion
- **Multi-Platform Support**: Google, Yelp, Facebook
- **Follow-Up Reminders**: Gentle nudges for non-responders
- **Response Tracking**: Monitor which customers left reviews
- **Sentiment Filtering**: Only ask happy customers for public reviews

### Components
- `packages/services/src/reviews.ts` - Review request service
- `apps/web/src/app/api/reviews/route.ts` - Reviews API
- `apps/web/src/app/(dashboard)/reviews/page.tsx` - Reviews dashboard
- `apps/web/src/app/r/[id]/route.ts` - Review redirect handler

### Review Request Workflow
1. Job completed
2. 24-hour delay (configurable)
3. Review request sent to customer
4. Customer clicks link
5. Redirected to preferred review platform
6. Interaction tracked

---

## Analytics Dashboard

### Overview
Comprehensive analytics showing AI-attributed revenue, conversion rates, and business performance metrics.

### Components
- `apps/web/src/app/api/analytics/route.ts` - Analytics API
- `apps/web/src/app/(dashboard)/analytics/page.tsx` - Main analytics dashboard
- `apps/web/src/app/(dashboard)/revenue/page.tsx` - AI Revenue dashboard

### Metrics Tracked
- **Total Revenue**: All-time and by period
- **AI-Attributed Revenue**: Revenue from AI-assisted interactions
- **Phone Call Metrics**: Call volume, duration, conversion rate
- **Quote Performance**: Sent, viewed, accepted, conversion rate
- **Invoice Status**: Pending, paid, overdue amounts
- **Review Performance**: Requests sent, reviews received, average rating

### Revenue Attribution
Revenue is tracked by source:
- Phone AI Bookings
- Quote Conversions
- Invoice Payments
- Walk-ins/Direct

---

## Settings & Configuration

### Overview
Central settings page for configuring AI features, pricing, and notification preferences.

### Location
`apps/web/src/app/(dashboard)/settings/page.tsx`

### Configuration Options

#### Business Settings
- Company name and contact info
- Default tax rate
- Business hours

#### AI Features
- Phone AI (on/off)
- AI Quote Generation (on/off)
- Auto-Invoice on Completion (on/off)
- Auto-Review Requests (on/off)

#### Pricing Settings
- Service catalog management
- Default prices by service type
- Tax rate configuration

#### Notification Settings
- Email notifications
- SMS notifications
- WhatsApp notifications
- Notification timing preferences

---

## API Reference

### Quotes API

```
GET /api/quotes
- List all quotes with stats

POST /api/quotes
- Create new quote
- Body: { customer_id, job_description, services, total }

GET /api/quotes/[id]
- Get single quote

POST /api/quotes/[id]/view
- Mark quote as viewed

POST /api/quotes/[id]/accept
- Accept quote and create job
```

### Invoices API

```
GET /api/invoices
- List all invoices with stats

POST /api/invoices
- Create new invoice
- Body: { job_id, customer_id, items, total }

GET /api/invoices/[id]
- Get single invoice

POST /api/invoices/[id]/view
- Mark invoice as viewed

POST /api/invoices/send
- Send invoice via email/WhatsApp
```

### Phone API

```
GET /api/phone
- Get call history and stats
- Query: action=history|stats

POST /api/phone/webhook
- Retell webhook endpoint
```

### Analytics API

```
GET /api/analytics
- Get all analytics data
- Query: range=7d|30d|90d|1y
```

---

## Technician Mobile View

### Overview
Mobile-optimized interface for field technicians to manage their daily jobs.

### Location
`apps/web/src/app/tech/page.tsx`

### Features
- Today's job list with priority indicators
- Job detail view with customer info
- One-tap navigation to job site
- Status updates (Start, Complete)
- Quick call/text buttons
- Photo upload capability
- Notes and time tracking

---

## Database Schema

### New Tables (Migration: 20260202_revenue_features.sql)

```sql
-- Quotes table
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  quote_number TEXT UNIQUE,
  job_id UUID REFERENCES jobs(id),
  customer_id UUID REFERENCES customers(id),
  items JSONB,
  subtotal DECIMAL,
  tax DECIMAL,
  total DECIMAL,
  status TEXT,
  valid_until TIMESTAMP,
  ai_generated BOOLEAN,
  created_at TIMESTAMP
);

-- Service catalog
CREATE TABLE service_catalog (
  id UUID PRIMARY KEY,
  name TEXT,
  category TEXT,
  base_price DECIMAL,
  unit TEXT,
  active BOOLEAN
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP
);

-- AI Revenue attribution
CREATE TABLE ai_revenue (
  id UUID PRIMARY KEY,
  source TEXT,
  amount DECIMAL,
  job_id UUID,
  created_at TIMESTAMP
);
```

---

## Environment Variables

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Retell AI
RETELL_API_KEY=
RETELL_AGENT_ID=
RETELL_WEBHOOK_SECRET=

# Email (Resend)
RESEND_API_KEY=
FROM_EMAIL=

# Local AI (Ollama)
OLLAMA_HOST=http://localhost:11434
```

---

## Getting Started

1. **Run database migration**
   ```bash
   supabase migration up
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env.local` and fill in values

3. **Enable AI features**
   Go to Settings > AI Features and enable desired features

4. **Configure Stripe webhooks**
   Add webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
   Events: `checkout.session.completed`, `payment_intent.*`

5. **Configure Retell AI**
   Set up agent with business-specific prompts
   Configure webhook: `https://yourdomain.com/api/phone/webhook`

6. **Test the flow**
   - Create a test job
   - Complete the job
   - Verify invoice generation
   - Test payment flow

---

## Support

For issues or feature requests, contact the development team or create an issue in the repository.
