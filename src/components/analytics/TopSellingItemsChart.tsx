import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Text, FlatList } from 'react-native'
import { BarChart } from 'react-native-gifted-charts'
import { getTopSellingItems, TopSellingItem } from '@/src/services/firebase/analytics'
import { colors, spacing } from '@/src/theme/styles'

interface TopSellingItemsChartProps {
  sellerId: string
}

export const TopSellingItemsChart: React.FC<TopSellingItemsChartProps> = ({ sellerId }) => {
  const [data, setData] = useState<TopSellingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [sellerId])

  const loadData = async () => {
    try {
      setLoading(true)
      const items = await getTopSellingItems(sellerId)
      setData(items)
    } catch (error) {
      console.error('Error loading top selling items:', error)
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
        <Text style={styles.emptyText}>No sales data available</Text>
      </View>
    )
  }

  const chartData = data.map(item => ({
    value: item.revenue,
    label: item.itemName.substring(0, 10),
    labelTextStyle: { color: colors.textSoft, fontSize: 11 }
  }))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Top Selling Items</Text>
        <Text style={styles.subtitle}>Revenue from best performers (Last 30 days)</Text>
      </View>

      <View style={styles.chartWrapper}>
        <BarChart
          data={chartData}
          height={250}
          barWidth={35}
          spacing={12}
          showValuesOnTopOfBars
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          frontColor={colors.primary}
          yAxisTextStyle={{ color: colors.textSoft, fontSize: 11 }}
        />
      </View>

      {/* Detailed List */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Detailed Breakdown</Text>
        <FlatList
          data={data.slice(0, 5)}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View style={styles.itemRow}>
              <View style={[styles.badge, { backgroundColor: getColor(index) }]}>
                <Text style={styles.badgeText}>{index + 1}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Text style={styles.itemStats}>
                  {item.itemsSold} sold • RM{item.revenue.toFixed(2)} revenue
                </Text>
              </View>
              <View style={styles.itemWaste}>
                <Text style={styles.wasteLabel}>Waste</Text>
                <Text style={styles.wasteValue}>{item.waste}</Text>
              </View>
            </View>
          )}
        />
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
  chartWrapper: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  listContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: 4,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    gap: spacing.md,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  itemStats: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 2,
  },
  itemWaste: {
    alignItems: 'flex-end',
  },
  wasteLabel: {
    fontSize: 10,
    color: colors.textSoft,
  },
  wasteValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B6B',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: spacing.lg,
  },
})
