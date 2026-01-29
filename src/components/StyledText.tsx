import { defaultFontFamily } from '@/src/theme/styles'
import { Text as RNText, TextInput as RNTextInput, StyleSheet, TextInputProps, TextProps } from 'react-native'

export function Text({ style, ...props }: TextProps) {
  return <RNText style={[styles.default, style]} {...props} />
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput style={[styles.default, style]} {...props} />
}

const styles = StyleSheet.create({
  default: {
    fontFamily: defaultFontFamily,
  },
})