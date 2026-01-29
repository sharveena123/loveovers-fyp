import { colors, fonts, spacing } from '@/src/theme/styles'
import React from 'react'
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'

interface HeaderProps {
  title: string
  subtitle?: string
  style?: ViewStyle
  titleStyle?: TextStyle
  subtitleStyle?: TextStyle
}

export default function Header({
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
}: HeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  } as ViewStyle,
  title: {
    ...fonts.heading,
    marginBottom: spacing.sm,
    color: colors.text,
  } as TextStyle,
  subtitle: {
    ...fonts.body,
    color: colors.textSoft,
    lineHeight: 24,
  } as TextStyle,
})
