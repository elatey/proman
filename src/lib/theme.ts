export type Theme = 'light' | 'dark' | 'system';
export const getTheme = (): Theme => (localStorage.getItem('proman.theme') as Theme) || 'light';
export const applyTheme = () => {
  const t = getTheme();
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
};
export const setTheme = (t: Theme) => { localStorage.setItem('proman.theme', t); applyTheme(); };
export const getAccent = () => localStorage.getItem('proman.accent') || '#6e56cf';
export const setAccent = (c: string) => { localStorage.setItem('proman.accent', c); document.documentElement.style.setProperty('--accent', c); };
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
