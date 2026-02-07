// Murray's FSM - Auth Hook
// =========================

import { useEffect } from 'react';
import { useObservable } from '@legendapp/state/react';
import { supabase } from '../services/supabase';
import { appState$, authState$ } from '../store';

export const useAuth = () => {
  const session = useObservable(authState$.session);
  const user = useObservable(authState$.user);
  const loading = useObservable(authState$.loading);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      authState$.session.set(session);
      authState$.user.set(session?.user ?? null);
      appState$.currentUserId.set(session?.user?.id ?? null);
      authState$.loading.set(false);
      appState$.authLoading.set(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        authState$.session.set(session);
        authState$.user.set(session?.user ?? null);
        appState$.currentUserId.set(session?.user?.id ?? null);
        authState$.loading.set(false);
        appState$.authLoading.set(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return data;
  };

  return {
    session: session.get(),
    user: user.get(),
    loading: loading.get(),
    signIn,
    signUp,
    signOut,
    resetPassword,
    isAuthenticated: !!session.get(),
  };
};
