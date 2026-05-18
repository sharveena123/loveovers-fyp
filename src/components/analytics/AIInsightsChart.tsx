import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Text, ScrollView } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import { getAIPredictionData, AIInsightData } from '@/src/services/firebase/analytics'
import { colors, spacing } from '@/src/theme/styles'

interface AIInsightsChartProps {
  sellerId: string
}

export const AIInsightsChart: React.FC<AIInsightsChartProps> = ({ sellerId }) => {
  const [data, setData] = useState<AIInsightData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [sellerId])

  const loadData = async () => {
    try {
      setLoading(true)
      const predictions = await getAIPredictionData(sellerId)
      setData(predictions)
    } catch (error) {
      console.error('Error loading AI prediction data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No prediction data available</Text>
      </View>
    )
  }

  // Get every 5th data point for cleaner labels
  const chartData = data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map(item => ({
    value: item.actual,
    value2: item.predicted,
    label: item.date,
    labelTextStyle: { color: colors.textSoft, fontSize: 11 }
  }))

  // Calculate accuracy
  const accuracy = data.length > 0 ? 
    100 - (data.reduce((sum, item) => sum + Math.abs(item.actual - item.predicted), 0) / data.reduce((sum, item) => sum + item.actual, 0) * 100) : 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Demand Prediction</Text>
        <Text style={styles.subtitle}>Actual vs Predicted demand (Last 30 days)</Text>
      </View>

      {/* Accuracy Badge */}
      <View style={styles.accuracyBadge}>
        <View style={styles.accuracyContent}>
          <Text style={styles.accuracyLabel}>Model Accuracy</Text>
          <Text style={styles.accuracyValue}>{Math.round(accuracy * 10) / 10}%</Text>
        </View>
        <View style={styles.accuracyIndicator} />
      </View>

      {/* Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
        <LineChart
          data={chartData}
          height={250}
          width={500}
          showValuesOnTopOfBars
          noOfSections={4}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          color={colors.primary}
          color2="#FF9800"
          thickness={2.5}
          thickness2={2.5}
          startFillColor={colors.primary}
          startOpacity={0.2}
          endOpacity={0}
          startFillColor2="#FF9800"
          startOpacity2={0.2}
          endOpacity2={0}
          yAxisLabelWidth={35}
          xAxisLabelWidth={50}
        />
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Actual Demand</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>AI Predicted</Text>
        </View>
      </View>

      {/* Insights */}
      <View style={styles.insights}>
        <Text style={styles.insightsTitle}>Insights</Text>
        <View style={styles.insightItem}>
          <Text style={styles.insightBullet}>📈</Text>
          <Text style={styles.insightText}>
            AI model predicts {Math.round(accuracy)}% accurate demand levels
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightBullet}>💡</Text>
          <Text style={styles.insightText}>
            Use predictions to optimize daily production levels
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightBullet}>⚡</Text>
          <Text style={styles.insightText}>
            Adjust inventory based on predicted demand patterns
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginVertical: spacing.sm,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 4,
  },
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  accuracyContent: {
    flex: 1,
  },
  accuracyLabel: {
    fontSize: 12,
    color: '#2E7D32',
  },
  accuracyValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2E7D32',
  },
  accuracyIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  chartScroll: {
    marginVertical: spacing.md,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: spacing.md,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 12,
    color: colors.text,
  },
  insights: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  insightBullet: {
    fontSize: 18,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: spacing.lg,
  },
})
