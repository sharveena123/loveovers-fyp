import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native'
import { LineChart, BarChart } from 'react-native-gifted-charts'
import { getWeeklySalesData, SalesData } from '@/src/services/firebase/analytics'
import { colors, spacing } from '@/src/theme/styles'

interface SalesPerformanceChartProps {
  sellerId: string
  chartType?: 'line' | 'bar'
}

export const SalesPerformanceChart: React.FC<SalesPerformanceChartProps> = ({ sellerId, chartType = 'line' }) => {
  const [data, setData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [sellerId])

  const loadData = async () => {
    try {
      setLoading(true)
      const salesData = await getWeeklySalesData(sellerId)
      setData(salesData)
    } catch (error) {
      console.error('Error loading sales performance data:', error)
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
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    )
  }

  const chartData = data.map(item => ({
    value: item.sales,
    label: item.day,
    labelTextStyle: { color: colors.textSoft, fontSize: 12 }
  }))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales Performance (Last 7 Days)</Text>
        <Text style={styles.subtitle}>Daily revenue trend</Text>
      </View>

      {chartType === 'line' ? (
        <LineChart
          data={chartData}
          height={250}
          showValuesOnTopOfBars
          noOfSections={4}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          color={colors.primary}
          thickness={3}
          startFillColor={colors.primary}
          startOpacity={0.3}
          endOpacity={0}
          scrollToEnd
        />
      ) : (
        <BarChart
          data={chartData}
          height={250}
          barWidth={30}
          spacing={10}
          showValuesOnTopOfBars
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          frontColor={colors.primary}
        />
      )}
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
  emptyText: {
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: spacing.lg,
  },
})
