import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Text, FlatList } from 'react-native'
import { getKPIMetrics, KPIMetrics } from '@/src/services/firebase/analytics'
import { colors, spacing } from '@/src/theme/styles'
import { TrendingUp, Package, Zap, DollarSign } from 'lucide-react-native'

interface KPIDashboardProps {
  sellerId: string
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({ sellerId }) => {
  const [metrics, setMetrics] = useState<KPIMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [sellerId])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      const data = await getKPIMetrics(sellerId)
      setMetrics(data)
    } catch (error) {
      console.error('Error loading KPI metrics:', error)
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

  if (!metrics) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No metrics available</Text>
      </View>
    )
  }

  const kpis = [
    {
      label: 'Total Sales',
      value: `RM${metrics.totalSales.toFixed(2)}`,
      icon: DollarSign,
      color: '#4CAF50',
      bgColor: '#E8F5E9',
    },
    {
      label: 'Items Sold',
      value: metrics.itemsSold.toString(),
      icon: Package,
      color: '#2196F3',
      bgColor: '#E3F2FD',
    },
    {
      label: 'Waste %',
      value: `${metrics.wastePercentage}%`,
      icon: TrendingUp,
      color: '#F44336',
      bgColor: '#FFEBEE',
    },
    {
      label: 'Revenue Saved',
      value: `RM${metrics.revenueSaved.toFixed(2)}`,
      icon: Zap,
      color: '#FF9800',
      bgColor: '#FFF3E0',
    },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Business KPIs</Text>
        <Text style={styles.subtitle}>Last 30 days performance</Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon
          return (
            <View key={index} style={[styles.kpiCard, { borderLeftColor: kpi.color }]}>
              <View style={[styles.iconContainer, { backgroundColor: kpi.bgColor }]}>
                <Icon size={20} color={kpi.color} />
              </View>
              <View style={styles.kpiContent}>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
              </View>
            </View>
          )
        })}
      </View>

      {/* Additional Metrics */}
      <View style={styles.additionalMetrics}>
        <Text style={styles.metricsTitle}>Additional Insights</Text>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Top Selling Product</Text>
          <Text style={styles.metricValue}>{metrics.topProduct}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Conversion Rate</Text>
          <View style={styles.conversionBar}>
            <View
              style={[
                styles.conversionFill,
                { width: `${Math.min(metrics.conversionRate, 100)}%` }
              ]}
            />
          </View>
          <Text style={styles.metricValue}>{metrics.conversionRate.toFixed(1)}%</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Average Order Value</Text>
          <Text style={styles.metricValue}>RM{metrics.averageOrderValue.toFixed(2)}</Text>
        </View>
      </View>

      {/* Recommendations */}
      <View style={styles.recommendations}>
        <Text style={styles.recommendationsTitle}>💡 Recommendations</Text>
        <View style={styles.recommendation}>
          <Text style={styles.recommendationText}>
            {metrics.wastePercentage > 20
              ? '⚠️ Waste percentage is high. Consider adjusting production quantities.'
              : '✅ Waste levels are healthy. Keep current production strategy.'}
          </Text>
        </View>
        <View style={styles.recommendation}>
          <Text style={styles.recommendationText}>
            {metrics.conversionRate < 50
              ? '📈 Conversion rate could be improved. Review product pricing and presentation.'
              : '🎯 Conversion rate is strong. Continue current marketing efforts.'}
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flex: 1,
    minWidth: '48%',
    padding: spacing.md,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiContent: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textSoft,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  additionalMetrics: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.lg,
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  metricRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  conversionBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  conversionFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  recommendations: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  recommendation: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: spacing.md,
  },
  recommendationText: {
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
