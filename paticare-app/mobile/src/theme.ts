// Design tokens for PatiCare.
//
// The original generated file only exported `Colors` / `Fonts` / `Theme`
// (capitalized, flat), while every screen imported either `{ theme }`
// (expecting `theme.colors` / `theme.fonts`) or `{ colors, fonts }`
// directly. Neither import matched what this file exported, so the app
// could not compile at all. This version exports every shape every
// screen actually uses, so nothing needs to guess anymore.

export const colors = {
  background: '#F7FBF8',
  foreground: '#17352C',
  primary: '#087F5B',
  primaryForeground: '#FFFFFF',
  secondary: '#DCEEFF',
  secondaryForeground: '#174A78',
  accent: '#E56A2C',
  accentForeground: '#FFFFFF',
  muted: '#EAF3EE',
  mutedForeground: '#587168',
  card: '#FFFFFF',
  cardForeground: '#17352C',
  border: '#CFE1D8',
  input: '#F1F7F3',
  destructive: '#C93838',
  destructiveForeground: '#FFFFFF',
  success: '#087F5B',
  successForeground: '#FFFFFF',
  chart1: '#087F5B',
  chart2: '#2C7DBB',
  chart3: '#D87A31',
  chart4: '#8067A8',
  chart5: '#5D9A83',
} as const;

export const fonts = {
  heading: 'Nunito Sans',
  body: 'Manrope',
} as const;

export const radius = 16;

export const theme = {
  colors,
  fonts,
  cornerRadius: radius,
} as const;

// Legacy aliases kept in case anything else references the original names.
export const Colors = colors;
export const Fonts = fonts;
export const Theme = { cornerRadius: radius } as const;

export type ThemeColors = typeof colors;
export default theme;
