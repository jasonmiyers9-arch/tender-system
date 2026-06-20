// Tender Guard Pro — Design Tokens
// Single source of truth for brand colours.
// Referenced by globals.css (:root vars) and used via CSS variable utility classes.

export const theme = {
  colors: {
    primary: '#4F46E5', // Indigo 600
    primaryDark: '#4338CA',
    secondary: '#0EA5E9',
    accent: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    border: '#E4E4E7',
    textPrimary: '#09090B',
    textMuted: '#71717A',
  },
} as const;

export type ThemeColors = typeof theme.colors;
