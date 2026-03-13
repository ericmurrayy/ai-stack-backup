// Murray's FSM - Payment Hook
// ============================

import { useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../services/supabase';
import { appState$ } from '../store';

interface PaymentResult {
  success: boolean;
  error?: string;
}

export const usePayment = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const createPayment = async (
    jobId: string,
    amountCents: number,
    customerEmail?: string
  ): Promise<PaymentResult> => {
    // Check network
    if (!appState$.isOnline.get()) {
      return {
        success: false,
        error: 'Payment requires an internet connection',
      };
    }

    setLoading(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      // Create payment intent via Edge Function
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            job_id: jobId,
            amount_cents: amountCents,
            customer_email: customerEmail,
          },
        }
      );

      if (functionError || !data) {
        return {
          success: false,
          error: functionError?.message || 'Failed to create payment',
        };
      }

      // Initialize payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Murray's Garage Door Service",
        paymentIntentClientSecret: data.paymentIntent,
        customerId: data.customer,
        customerEphemeralKeySecret: data.ephemeralKey,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: customerEmail,
        },
      });

      if (initError) {
        return { success: false, error: initError.message };
      }

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          return { success: false, error: 'Payment cancelled' };
        }
        return { success: false, error: presentError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Payment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    createPayment,
    loading,
  };
};
