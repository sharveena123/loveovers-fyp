import { Plus } from 'lucide-react-native'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface DashboardHeaderProps {
  shopName: string
  onAdd: () => void
}

export default function DashboardHeader({ shopName, onAdd }: DashboardHeaderProps) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.shopName}>{shopName}</Text>
        <Text style={styles.subtitle}>Owner Dashboard</Text>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={onAdd}>
        <Plus size={16} color="#00ACC1" />
        <Text style={styles.addText}>Add Bag</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 46,
    backgroundColor: '#406f32ff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 16,
  },
  shopName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#fff', opacity: 0.8, marginTop: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 8, borderRadius: 12 },
  addText: { color: '#00ACC1', marginLeft: 4, fontWeight: '600' },
})
