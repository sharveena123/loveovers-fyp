import { Stack, styled } from 'tamagui'

// Progress Container
const ProgressContainer = styled(Stack, {
  width: '100%',
  height: 8,
  backgroundColor: '$backgroundDark',
  borderRadius: '$round',
  overflow: 'hidden',
  position: 'relative',

  variants: {
    size: {
      sm: {
        height: 6,
      },
      md: {
        height: 8,
      },
      lg: {
        height: 12,
      },
    },
  } as const,

  defaultVariants: {
    size: 'md',
  },
})

// Progress Fill
const ProgressFill = styled(Stack, {
  height: '100%',
  backgroundColor: '$primary',
  borderRadius: '$round',
  transition: 'width 0.3s ease',

  variants: {
    variant: {
      primary: {
        backgroundColor: '$primary',
      },
      success: {
        backgroundColor: '$success',
      },
      error: {
        backgroundColor: '$error',
      },
      warning: {
        backgroundColor: '$warning',
      },
      secondary: {
        backgroundColor: '$secondary',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'primary',
  },
})

interface ProgressProps {
  value: number
  max?: number
  variant?: 'primary' | 'success' | 'error' | 'warning' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  marginBottom?: string | number
}

export function Progress({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  className,
  marginBottom,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <ProgressContainer size={size} className={className} marginBottom={marginBottom}>
      <ProgressFill
        variant={variant}
        width={`${percentage}%`}
      />
    </ProgressContainer>
  )
}

// Alternative simpler version without styled components
export function SimpleProgress({
  value,
  max = 100,
  variant = 'primary',
  height = 8,
  marginBottom,
}: {
  value: number
  max?: number
  variant?: 'primary' | 'success' | 'error' | 'warning' | 'secondary'
  height?: number
  marginBottom?: string | number
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const colorMap = {
    primary: '$primary',
    success: '$success',
    error: '$error',
    warning: '$warning',
    secondary: '$secondary',
  }

  return (
    <Stack
      width="100%"
      height={height}
      backgroundColor="$backgroundDark"
      borderRadius="$round"
      overflow="hidden"
      marginBottom={marginBottom}
    >
      <Stack
        height="100%"
        width={`${percentage}%`}
        backgroundColor={colorMap[variant]}
        borderRadius="$round"
      />
    </Stack>
  )
}