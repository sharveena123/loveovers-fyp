import { DollarSign, Package } from 'lucide-react-native'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface StatCardProps {
  label: string
  value: string | number
  icon: 'bag' | 'revenue' | 'inventory'
}

export default function StatCard({ label, value, icon }: StatCardProps) {
  const Icon = icon === 'bag' ? Package : DollarSign
  const bgColor = icon === 'bag' ? '#E0F7FA' : '#E0F7FA'
  const iconColor = icon === 'bag' ? '#00ACC1' : '#00ACC1'

  return (
    <View style={[styles.card]}>
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Icon size={20} color={iconColor} />
      </View>
      <View>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  value: { fontSize: 20, fontWeight: '600', color: '#111' },
  label: { fontSize: 12, color: '#666' },
})
