import { StyleSheet } from 'react-native'

export const colors = {
  primary: '#6a3c00ff',
  primarySoft: '#fff7efff',
  success: '#8F9779ff',
  successSoft: '#e7f1e5ff',
  error: '#dc2626',
  errorSoft: '#fee2e2',
  backgroundSoft: '#e7f1e5ff',
  background: '#fff7efff',
  text: '#000',
  textSoft: '#666',
  border: '#e5e5e5',
  buttonText: '#fff',
  white: '#fff',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

// Font family names
export const fontFamilies = {
  heading: 'Poppins_600SemiBold',
  body: 'DMSans_400Regular',
}

// Default font that applies everywhere
export const defaultFontFamily = fontFamilies.body

export const fonts = {
  heading: { 
    fontSize: 28, 
    fontWeight: '600' as const,
    fontFamily: fontFamilies.heading,
  },
  subheading: { 
    fontSize: 20, 
    fontWeight: '500' as const,
    fontFamily: fontFamilies.heading,
  },
  body: { 
    fontSize: 16, 
    fontWeight: '400' as const,
    fontFamily: fontFamilies.body,
  },
  small: { 
    fontSize: 14, 
    fontWeight: '400' as const,
    fontFamily: fontFamilies.body,
  },
}

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    color: colors.text,
    fontFamily: defaultFontFamily, 
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm * 3,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.buttonText,
    fontWeight: '600',
    fontSize: fonts.body.fontSize,
    fontFamily: fontFamilies.heading,
  },
  label: {
    fontSize: fonts.small.fontSize,
    color: colors.textSoft,
    marginBottom: spacing.xs,
    fontFamily: defaultFontFamily,
  },
})