import { create } from 'zustand';
type Language = 'en' | 'fa-AF' | 'ps-AF';
export const usePreferences = create<{
  language: Language;
  setLanguage: (language: Language) => void;
  theme: 'light' | 'dark';
  navigationMode: 'sidebar' | 'top';
  setTheme: (theme: 'light' | 'dark') => void;
  setNavigationMode: (mode: 'sidebar' | 'top') => void;
}>((set) => ({
  language: (localStorage.getItem('myt-language') as Language) || 'fa-AF',
  theme: localStorage.getItem('myt-theme') === 'dark' ? 'dark' : 'light',
  navigationMode:
    localStorage.getItem('myt-navigation') === 'top' ? 'top' : 'sidebar',
  setTheme: (theme) => {
    localStorage.setItem('myt-theme', theme);
    set({ theme });
  },
  setNavigationMode: (navigationMode) => {
    localStorage.setItem('myt-navigation', navigationMode);
    set({ navigationMode });
  },
  setLanguage: (language) => {
    localStorage.setItem('myt-language', language);
    set({ language });
  },
}));
