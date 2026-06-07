import { createContext, useContext } from 'react';
import type {
  SaveUserProfileInput,
  SupabaseSession,
  SupabaseUser,
  UserProfile
} from '../utils/supabaseClient';

export interface AuthContextValue {
  session: SupabaseSession | null;
  user: SupabaseUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  authCallbackMessage: string | null;
  isConfigured: boolean;
  clearAuthCallbackMessage: () => void;
  loadUserProfile: () => Promise<UserProfile | null>;
  saveUserProfile: (profile: SaveUserProfileInput) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
  sendMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
