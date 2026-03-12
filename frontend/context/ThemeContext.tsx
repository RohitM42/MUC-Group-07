import React, { createContext, useContext, useState } from 'react';
import { ColourPalette, Theme, PALETTES } from '../constants/colours';

// Types -----------------------------------------------------------------------

interface ThemeContextValue {
  theme:       Theme;
  colours:     ColourPalette;
  isDark:      boolean;
  toggleTheme: () => void;
}

// Context setup ---------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

// Provider --------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  const colours     = PALETTES[theme];
  const isDark      = theme === 'dark';
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, colours, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
