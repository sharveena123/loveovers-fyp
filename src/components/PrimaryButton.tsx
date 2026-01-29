import { colors } from '@/src/theme/styles'
import {
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from 'react-native'

type ButtonVariant = 'default' | 'outlined' | 'error'

interface ButtonProps {
  title: string
  onPress: () => void
  disabled?: boolean
  variant?: ButtonVariant
  style?: ViewStyle
  textStyle?: TextStyle
}

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  variant = 'default',
  style,
  textStyle,
}: ButtonProps) {
  // Determine styles based on variant
  const backgroundColor =
    variant === 'default'
      ? disabled
        ? '#99caff'
        : colors.primary
      : variant === 'error'
      ? '#ff4d4d'
      : 'transparent'

  const borderWidth = variant === 'outlined' ? 2 : 0
  const borderColor = variant === 'outlined' ? colors.primary : 'transparent'

  const textColor =
    variant === 'default'
      ? '#fff'
      : variant === 'error'
      ? '#fff'
      : colors.primary

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor, borderWidth, borderColor },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, { color: textColor }, textStyle]}>
        {title}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  } as ViewStyle,
  text: {
    fontWeight: '600',
    fontSize: 16,
  } as TextStyle,
})
