// Murray's FSM - Root Layout
// ===========================

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useObservable } from '@legendapp/state/react';
import { useAuth } from '../src/hooks';
import { authState$ } from '../src/store';
import { setupNetworkListener } from '../src/utils/network';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

function AuthWrapper() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, loading]);

  return null;
}

export default function RootLayout() {
  // Setup network listener
  useEffect(() => {
    const cleanup = setupNetworkListener();
    return cleanup;
  }, []);

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <AuthWrapper />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="job/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Job Details',
            headerBackTitle: 'Back',
            presentation: 'card',
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </StripeProvider>
  );
}
