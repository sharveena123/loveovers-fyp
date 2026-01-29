import { Text, YStack } from 'tamagui'

type Status = 'fresh' | 'expiring' | 'expired' | 'high' | 'medium' | 'low'

interface StatusBadgeProps {
  status: Status
  label?: string
  backgroundColor?: string
  color?: string
  borderColor?: string
}

export function StatusBadge({ 
  status, 
  label, 
  backgroundColor, 
  color,
  borderColor 
}: StatusBadgeProps) {
  // Default mapping for inventory statuses
  const defaultMap: Record<Status, { bg: string; text: string; label: string }> = {
    fresh: {
      bg: '$green100',
      text: '$green700',
      label: 'Fresh'
    },
    expiring: {
      bg: '$yellow100',
      text: '$yellow700',
      label: 'Expiring Soon'
    },
    expired: {
      bg: '$red100',
      text: '$red700',
      label: 'Expired'
    },
    high: {
      bg: 'transparent',
      text: '$primary',
      label: 'High'
    },
    medium: {
      bg: 'transparent',
      text: '$secondary',
      label: 'Medium'
    },
    low: {
      bg: 'transparent',
      text: '$muted',
      label: 'Low'
    }
  }

  const defaults = defaultMap[status]
  
  // Use custom props if provided, otherwise use defaults
  const finalBg = backgroundColor || defaults.bg
  const finalColor = color || defaults.text
  const finalLabel = label || defaults.label
  const hasBorder = borderColor || (status === 'high' || status === 'medium' || status === 'low')

  return (
    <YStack 
      backgroundColor={finalBg}
      padding="$2"
      paddingHorizontal="$3"
      borderRadius="$3"
      borderWidth={hasBorder ? 1 : 0}
      borderColor={borderColor || finalColor}
    >
      <Text fontSize="$2" fontWeight="600" color={finalColor}>
        {finalLabel}
      </Text>
    </YStack>
  )
}