import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Text, ScrollView } from 'react-native'
import { PieChart, StackedBarChart } from 'react-native-gifted-charts'
import { getWasteAnalysis, WasteData } from '@/src/services/firebase/analytics'
import { colors, spacing } from '@/src/theme/styles'

interface WasteAnalysisChartProps {
  sellerId: string
  chartType?: 'pie' | 'stacked'
}

export const WasteAnalysisChart: React.FC<WasteAnalysisChartProps> = ({ sellerId, chartType = 'stacked' }) => {
  const [data, setData] = useState<WasteData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [sellerId])

  const loadData = async () => {
    try {
      setLoading(true)
      const wasteData = await getWasteAnalysis(sellerId)
      setData(wasteData)
    } catch (error) {
      console.error('Error loading waste analysis data:', error)
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
        <Text style={styles.emptyText}>No waste data available</Text>
      </View>
    )
  }

  // For pie chart - waste distribution
  const pieData = data.slice(0, 5).map((item, index) => ({
    value: item.waste,
    label: item.itemName,
    color: getColor(index),
  }))

  // For stacked bar chart - sold vs waste
  const stackedData = data.slice(0, 5).map(item => ({
    label: item.itemName.substring(0, 8),
    stacks: [
      {
        value: item.sold,
        color: colors.success,
      },
      {
        value: item.waste,
        color: '#FF6B6B',
      },
    ],
  }))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {chartType === 'pie' ? 'Waste Distribution' : 'Sold vs Waste Analysis'}
        </Text>
        <Text style={styles.subtitle}>
          {chartType === 'pie' 
            ? 'Top items contributing to waste' 
            : 'Items sold vs waste (last 30 days)'}
        </Text>
      </View>

      {chartType === 'pie' ? (
        <View style={styles.chartContainer}>
          <PieChart
            data={pieData}
            donut
            showValuesAsLabels
            radius={100}
            innerRadius={60}
            centerLabelComponent={() => (
              <View style={styles.donutCenter}>
                <Text style={styles.donutText}>Waste</Text>
                <Text style={styles.donutValue}>
                  {data.reduce((sum, item) => sum + item.waste, 0)}
                </Text>
              </View>
            )}
          />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <StackedBarChart
            data={stackedData}
            height={250}
            width={400}
            barWidth={30}
            spacing={15}
            yAxisColor={colors.border}
            xAxisColor={colors.border}
          />
        </ScrollView>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Sold</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF6B6B' }]} />
          <Text style={styles.legendText}>Waste</Text>
        </View>
      </View>

      {/* Waste percentage breakdown */}
      <View style={styles.breakdown}>
        {data.slice(0, 3).map((item, index) => (
          <View key={index} style={styles.breakdownItem}>
            <Text style={styles.breakdownItemName}>{item.itemName}</Text>
            <Text style={styles.breakdownItemStats}>
              {item.sold} sold / {item.waste} waste ({item.wastePercentage.toFixed(1)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const getColor = (index: number) => {
  const colors_ = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0']
  return colors_[index % colors_.length]
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
  },
  donutCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutText: {
    fontSize: 12,
    color: colors.textSoft,
  },
  donutValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: colors.text,
  },
  breakdown: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  breakdownItem: {
    paddingVertical: spacing.sm,
  },
  breakdownItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  breakdownItemStats: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: spacing.lg,
  },
})
