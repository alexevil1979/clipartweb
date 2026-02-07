import { create } from 'zustand';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isLoading: true,
  isAuthenticated: !!localStorage.getItem('auth_token'),

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('auth_token', data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  register: async (name, email, password) => {
    const { data } = await authApi.register({
      name,
      email,
      password,
      password_confirmation: password,
    });
    localStorage.setItem('auth_token', data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const { data } = await authApi.me();
      set({ user: data.user, isLoading: false, isAuthenticated: true });
    } catch {
      localStorage.removeItem('auth_token');
      set({ user: null, token: null, isLoading: false, isAuthenticated: false });
    }
  },

  setToken: (token) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },
}));
