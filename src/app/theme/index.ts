// Calm, trauma-informed palette. Avoid alarming reds for routine UI; reserve red for destructive only.
export const theme = {
  colors: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    primary: '#0E1A2B',
    primaryAccent: '#2C7DA0',
    text: '#1A2533',
    textMuted: '#5C6B7A',
    border: '#D9DEE5',
    success: '#2E7D5B',
    warn: '#B7791F',
    danger: '#B23A48',
    severity: {
      info: '#3E6FB0',
      watch: '#B7791F',
      serious: '#B23A48',
    },
  },
  spacing: (n: number) => n * 4,
  radius: 12,
  font: {
    h1: 24,
    h2: 18,
    body: 15,
    small: 13,
    tiny: 11,
  },
};
