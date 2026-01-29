import { colors, spacing } from '@/src/theme/styles'
import { Text, TouchableOpacity } from 'react-native'

interface BackButtonProps {
  text: string
  onPress: () => void
  style?: object
}

export default function BackButton({ text, onPress, style }: BackButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: 'center', marginTop: spacing.md, ...style }}>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>{text}</Text>
    </TouchableOpacity>
  )
}
