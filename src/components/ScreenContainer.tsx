import { commonStyles } from '@/src/theme/styles'
import { StyleProp, View, ViewStyle } from 'react-native'

interface ScreenContainerProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export default function ScreenContainer({ children, style }: ScreenContainerProps) {
  return (
    <View
      style={[
        commonStyles.container,
        {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
