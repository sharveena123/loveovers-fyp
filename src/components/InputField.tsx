import { colors } from '@/src/theme/styles'
import { StyleSheet, TextInput, TextStyle } from 'react-native'

interface InputFieldProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad'
  style?: TextStyle
}

export default function InputField({
  value,
  onChangeText,
  placeholder = '',
  secureTextEntry = false,
  keyboardType = 'default',
  style,
}: InputFieldProps) {
  return (
    <TextInput
      style={[styles.input, style]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      placeholderTextColor={colors.textSoft}
      autoCapitalize="none"
      autoCorrect={false}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#fff',
  },
})