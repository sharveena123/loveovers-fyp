import { AlertCircle } from 'lucide-react-native'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface InventoryItemCardProps {
  item: any
  onDelete: (id: string) => void
}

export default function InventoryItemCard({ item, onDelete }: InventoryItemCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.text}>Quantity: {item.quantity} | Category: {item.category}</Text>
          {item.originalPrice && (
            <Text style={styles.text}>Price: ${item.discountedPrice} (was ${item.originalPrice})</Text>
          )}
          {item.description && <Text style={styles.text}>{item.description}</Text>}
        </View>
        <View style={styles.status}>
          <Text>{item.status}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.expiry}>
          <AlertCircle size={16} color="#666" />
          <Text style={[styles.text, { marginLeft: 4 }]}>
            Expires: {new Date(item.expiryDate).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
          <Text style={{ color: '#fff' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, marginBottom: 12 },
  header: { flexDirection: 'row', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  text: { fontSize: 12, color: '#666' },
  status: { justifyContent: 'center', alignItems: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expiry: { flexDirection: 'row', alignItems: 'center' },
  deleteButton: { backgroundColor: '#D32F2F', padding: 8, borderRadius: 8 },
})
