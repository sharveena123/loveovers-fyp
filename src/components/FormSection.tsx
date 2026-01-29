import { spacing } from '@/src/theme/styles'
import { StyleProp, View, ViewStyle } from 'react-native'

interface FormSectionProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export default function FormSection({ children, style }: FormSectionProps) {
  return <View style={[{ marginBottom: spacing.lg }, style]}>{children}</View>
}
