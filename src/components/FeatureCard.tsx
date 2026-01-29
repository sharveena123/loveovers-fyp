import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface FeatureCardProps {
  title: string
  description: string
  onPress: () => void
}

export default function FeatureCard({ title, description, onPress }: FeatureCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <TouchableOpacity style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>Explore</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  description: { fontSize: 14, color: '#666', marginBottom: 12 },
  button: { backgroundColor: '#00ACC1', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
})
