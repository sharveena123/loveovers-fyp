import { colors, fonts, spacing } from '@/src/theme/styles'
import React from 'react'
import {
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native'

interface FooterLinkProps {
  text: string
  linkText: string
  onPress: () => void
  containerStyle?: ViewStyle
  textStyle?: TextStyle
  linkStyle?: TextStyle
}

export default function FooterLink({
  text,
  linkText,
  onPress,
  containerStyle,
  textStyle,
  linkStyle,
}: FooterLinkProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.text, textStyle]}>{text}</Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={[styles.link, linkStyle]}>{linkText}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  } as ViewStyle,
  text: {
    ...(fonts.body as TextStyle), // cast to TextStyle
    color: colors.textSoft,
    fontSize: 14,
  } as TextStyle,
  link: {
    ...(fonts.body as TextStyle), // cast to TextStyle
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 2,
  } as TextStyle,
})
