import type { Backend } from './types';
import { LocalBackend } from './local';
import { SupabaseBackend } from './supabase';

// Supabase credentials come from build-time env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// or can be entered at runtime on the login screen (saved in localStorage).
// The anon key is designed to be public; Row Level Security protects the data.
const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const getSupabaseConfig = () => {
  const url = envUrl || localStorage.getItem('proman.sb.url') || '';
  const key = envKey || localStorage.getItem('proman.sb.key') || '';
  return { url, key, fromEnv: !!envUrl };
};

export const setSupabaseConfig = (url: string, key: string) => {
  if (url && key) {
    localStorage.setItem('proman.sb.url', url.trim());
    localStorage.setItem('proman.sb.key', key.trim());
  } else {
    localStorage.removeItem('proman.sb.url');
    localStorage.removeItem('proman.sb.key');
  }
};

const forceLocal = localStorage.getItem('proman.forceLocal') === '1';
const cfg = getSupabaseConfig();

export const backend: Backend = cfg.url && cfg.key && !forceLocal ? new SupabaseBackend(cfg.url, cfg.key) : new LocalBackend();

export const setForceLocal = (v: boolean) => {
  if (v) localStorage.setItem('proman.forceLocal', '1');
  else localStorage.removeItem('proman.forceLocal');
};

export type { Backend };
