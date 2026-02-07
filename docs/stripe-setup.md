# Stripe Setup - Murray's FSM

This guide covers setting up Stripe payments for Murray's FSM.

## Prerequisites

- Stripe account (test mode works for development)
- Mobile app with Stripe SDK
- Supabase Edge Function deployed

## Step 1: Get API Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** > **API keys**
3. Copy:
   - **Publishable key** (starts with `pk_`)
   - **Secret key** (starts with `sk_`)

For development, use test mode keys (`pk_test_` / `sk_test_`).

## Step 2: Configure Supabase Edge Function

1. Set environment variables in Supabase:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_xxx
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_xxx
```

2. Deploy the Edge Function:

```bash
supabase functions deploy create-payment-intent
```

## Step 3: Configure Stripe Webhook

1. In Stripe Dashboard, go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Configure:
   - **Endpoint URL:** `https://your-n8n.com/webhook/stripe-webhook`
   - **Events:**
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
4. Copy **Signing secret** (starts with `whsec_`)
5. Set in n8n: `STRIPE_WEBHOOK_SECRET`

## Step 4: Mobile App Configuration

Add to your mobile app's `.env`:

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx
```

### iOS Setup

1. Update `app.json`:

```json
{
  "plugins": [
    [
      "@stripe/stripe-react-native",
      {
        "merchantIdentifier": "merchant.com.yourcompany.app",
        "enableGooglePay": true
      }
    ]
  ]
}
```

2. For Apple Pay, register merchant ID in Apple Developer portal

### Android Setup

For Google Pay, add to `app.json`:

```json
{
  "android": {
    "googleServicesFile": "./google-services.json"
  }
}
```

## Payment Flow

### 1. Create Payment Intent

Mobile app calls Supabase Edge Function:

```typescript
const { data, error } = await supabase.functions.invoke(
  'create-payment-intent',
  {
    body: {
      job_id: 'uuid',
      amount_cents: 15000,
      customer_email: 'customer@example.com'
    }
  }
);
```

Response:
```json
{
  "paymentIntent": "pi_xxx_secret_xxx",
  "ephemeralKey": "ek_xxx",
  "customer": "cus_xxx",
  "publishableKey": "pk_xxx"
}
```

### 2. Present Payment Sheet

```typescript
const { initPaymentSheet, presentPaymentSheet } = useStripe();

// Initialize
await initPaymentSheet({
  merchantDisplayName: "Murray's Garage Door Service",
  paymentIntentClientSecret: data.paymentIntent,
  customerId: data.customer,
  customerEphemeralKeySecret: data.ephemeralKey,
});

// Present
const { error } = await presentPaymentSheet();
```

### 3. Handle Webhook

Stripe sends `payment_intent.succeeded` to n8n:

1. Verify signature
2. Update `payments` table status to `succeeded`
3. Trigger will update `jobs.paid_cents`

## Testing

### Test Card Numbers

| Card | Number | Use Case |
|------|--------|----------|
| Visa | `4242424242424242` | Successful payment |
| Visa | `4000000000000002` | Declined |
| Visa | `4000000000009995` | Insufficient funds |

Use any future expiry date and any CVC.

### Test Flow

1. Create a job with line items
2. On mobile, navigate to job
3. Tap "Collect Payment"
4. Enter test card `4242424242424242`
5. Complete payment
6. Verify:
   - `payments` table has new row
   - Status is `succeeded`
   - `jobs.paid_cents` is updated

## Refunds

To process refunds via Stripe Dashboard:

1. Go to **Payments** in Stripe
2. Find the payment
3. Click **Refund**
4. Enter amount and reason

The `charge.refunded` webhook will:
1. Update payment status to `refunded`
2. Update `jobs.paid_cents`

## Going Live

1. Complete Stripe account verification
2. Switch to live API keys
3. Update all environment variables:
   - Mobile: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Supabase: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
   - n8n: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
4. Create new live webhook endpoint
5. Test with a real card (process a small refundable amount)

## Troubleshooting

### "No such payment_intent"
- Verify you're using matching keys (test with test, live with live)
- Check the payment intent ID is correct

### Payment sheet not opening
- Ensure Stripe SDK is initialized with StripeProvider
- Verify publishable key is correct
- Check for initialization errors in logs

### Webhook signature invalid
- Verify webhook secret matches exactly
- Ensure raw body is used for verification
- Check endpoint URL matches Stripe dashboard

### Payment succeeds but status not updating
- Check n8n workflow is active
- Verify webhook events are being received
- Review n8n execution logs for errors
