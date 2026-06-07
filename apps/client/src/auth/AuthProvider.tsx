import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import {
  fetchUserProfile,
  initialAuthCallbackMessage,
  saveUserProfile as persistUserProfile,
  supabase,
  type SaveUserProfileInput,
  type SupabaseSession,
  type UserProfile
} from '../utils/supabaseClient';
import { AuthContext, type AuthContextValue } from './AuthContext';
import {
  getAuthRedirectUrl,
  shouldNormalizeAuthCallbackRoute
} from './authRedirect';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [isLoading, setIsLoading] = useState(!!supabase);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [authCallbackMessage, setAuthCallbackMessage] = useState(initialAuthCallbackMessage);
  const isConfigured = !!supabase;

  const loadProfileByUserId = useCallback(async (userId: string) => {
    setProfileLoading(true);
    const { data, error } = await fetchUserProfile(userId);
    setProfileLoading(false);

    if (error) {
      setProfileError(error);
      return null;
    }

    setProfileError(null);
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    const syncSession = (nextSession: SupabaseSession | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsLoading(false);

      if (nextSession?.user) {
        if (shouldNormalizeAuthCallbackRoute(window.location.hash)) {
          window.location.hash = '#/app';
        }
        setAuthCallbackMessage(null);
        setProfile(null);
        setProfileError(null);
        void loadProfileByUserId(nextSession.user.id);
        return;
      }

      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => syncSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession) => {
      syncSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfileByUserId]);

  const loadUserProfile = useCallback(async () => {
    const currentUserId = session?.user?.id;
    if (!currentUserId) {
      setProfile(null);
      setProfileError(null);
      return null;
    }

    return loadProfileByUserId(currentUserId);
  }, [loadProfileByUserId, session?.user?.id]);

  const saveUserProfile = useCallback(async (nextProfile: SaveUserProfileInput) => {
    const currentUserId = session?.user?.id;
    if (!currentUserId) return '请先登录 MuseSync 账号。';

    const { data, error } = await persistUserProfile(currentUserId, nextProfile);
    if (error) {
      setProfileError(error);
      return error;
    }

    setProfileError(null);
    setProfile(data);
    return null;
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    isLoading,
    profileLoading,
    profileError,
    authCallbackMessage,
    isConfigured,
    clearAuthCallbackMessage: () => setAuthCallbackMessage(null),
    loadUserProfile,
    saveUserProfile,
    signInWithPassword: async (email, password) => {
      if (!supabase) return 'Supabase is not configured.';
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data.session) {
        setSession(data.session);
        setProfile(null);
        setProfileError(null);
        void loadProfileByUserId(data.session.user.id);
      }
      return error?.message ?? null;
    },
    signUpWithPassword: async (email, password) => {
      if (!supabase) return 'Supabase is not configured.';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(window.location)
        }
      });
      if (data.session) {
        setSession(data.session);
        setProfile(null);
        setProfileError(null);
        void loadProfileByUserId(data.session.user.id);
      }
      return error?.message ?? null;
    },
    sendMagicLink: async (email) => {
      if (!supabase) return 'Supabase is not configured.';
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(window.location)
        }
      });
      return error?.message ?? null;
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
      setProfile(null);
      setProfileError(null);
    }
  }), [
    isConfigured,
    isLoading,
    authCallbackMessage,
    loadProfileByUserId,
    loadUserProfile,
    profile,
    profileError,
    profileLoading,
    saveUserProfile,
    session
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
