import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Text, FlatList } from 'react-native'
import { BarChart, PieChart } from 'react-native-gifted-charts'
import { getRevenueBreakdown, RevenueData } from '@/src/services/firebase/analytics'
import { colors, spacing } from '@/src/theme/styles'

interface RevenueBreakdownChartProps {
  sellerId: string
}

export const RevenueBreakdownChart: React.FC<RevenueBreakdownChartProps> = ({ sellerId }) => {
  const [data, setData] = useState<RevenueData[]>([])
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie')

  useEffect(() => {
    loadData()
  }, [sellerId])

  const loadData = async () => {
    try {
      setLoading(true)
      const breakdown = await getRevenueBreakdown(sellerId)
      setData(breakdown)
    } catch (error) {
      console.error('Error loading revenue breakdown:', error)
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
        <Text style={styles.emptyText}>No revenue data available</Text>
      </View>
    )
  }

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
  const pieData = data.map((item, index) => ({
    value: item.revenue,
    label: item.period,
    color: index === 0 ? colors.primary : '#FF9800',
    percentage: Math.round((item.revenue / totalRevenue) * 100)
  }))

  const barData = data.map((item, index) => ({
    value: item.revenue,
    label: item.period.substring(0, 10),
    labelTextStyle: { color: colors.textSoft, fontSize: 11 },
    frontColor: index === 0 ? colors.primary : '#FF9800'
  }))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Revenue Breakdown</Text>
        <Text style={styles.subtitle}>Regular vs Mystery Bags</Text>
      </View>

      <View style={styles.chartContainer}>
        {chartType === 'pie' ? (
          <PieChart
            data={pieData}
            donut
            radius={90}
            innerRadius={50}
            centerLabelComponent={() => (
              <View style={styles.donutCenter}>
                <Text style={styles.donutLabel}>Total</Text>
                <Text style={styles.donutValue}>RM{totalRevenue.toFixed(0)}</Text>
              </View>
            )}
          />
        ) : (
          <BarChart
            data={barData}
            height={220}
            barWidth={50}
            spacing={30}
            showValuesOnTopOfBars
            yAxisColor={colors.border}
            xAxisColor={colors.border}
          />
        )}
      </View>

      {/* Revenue Details */}
      <View style={styles.details}>
        {data.map((item, index) => (
          <View key={index} style={styles.detailRow}>
            <View style={[styles.detailBadge, { backgroundColor: index === 0 ? colors.primary : '#FF9800' }]} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>{item.period}</Text>
              <Text style={styles.detailStats}>
                RM{item.revenue.toFixed(2)} • {Math.round((item.revenue / totalRevenue) * 100)}%
              </Text>
            </View>
            <Text style={styles.detailAmount}>RM{item.revenue.toFixed(2)}</Text>
          </View>
        ))}
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
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
    minHeight: 200,
  },
  donutCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutLabel: {
    fontSize: 12,
    color: colors.textSoft,
  },
  donutValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  details: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  detailBadge: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  detailStats: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 2,
  },
  detailAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: spacing.lg,
  },
})
