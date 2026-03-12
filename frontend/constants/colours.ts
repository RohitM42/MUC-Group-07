// Colour palettes -------------------------------------------------------------

export type Theme = 'dark' | 'light';

export interface ColourPalette {
  background:  string;
  surface:     string;
  border:      string;
  text:        string;
  textSub:     string;
  textDim:     string;
  accent:      string;
  accentMuted: string;
  error:       string;
  warning:     string;
}

export const DARK: ColourPalette = {
  background:  '#111111',
  surface:     '#1a1a1a',
  border:      '#2a2a2a',
  text:        '#ffffff',
  textSub:     '#6b7280',
  textDim:     '#4b5563',
  accent:      '#22c55e',
  accentMuted: '#2a4a35',
  error:       '#ef4444',
  warning:     '#f59e0b',
};

export const LIGHT: ColourPalette = {
  background:  '#f4f4f5',
  surface:     '#ffffff',
  border:      '#e4e4e7',
  text:        '#111111',
  textSub:     '#6b7280',
  textDim:     '#9ca3af',
  accent:      '#22c55e',
  accentMuted: '#dcfce7',
  error:       '#ef4444',
  warning:     '#f59e0b',
};

export const PALETTES: Record<Theme, ColourPalette> = { dark: DARK, light: LIGHT };
