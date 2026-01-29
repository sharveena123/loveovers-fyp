import { Text } from '@/src/components/StyledText'
import { auth } from '@/src/services/firebase/config'
import { Order, orderService } from '@/src/services/firebase/inventoryServices'
import { getUserProfile, SellerProfile } from '@/src/services/firebase/user'
import { colors, spacing } from '@/src/theme/styles'
import { router } from 'expo-router'
import { Clock, Phone, Search } from 'lucide-react-native'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'ready' | 'completed'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, activeFilter, searchQuery])

  const checkAuthAndLoadData = async () => {
    const user = auth.currentUser

    if (!user) {
      Alert.alert('Error', 'Please login to continue', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ])
      return
    }

    try {
      const profile = await getUserProfile(user.uid)

      if (!profile || profile.role !== 'seller') {
        Alert.alert('Error', 'Seller profile not found', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') },
        ])
        return
      }

      setSellerProfile(profile as SellerProfile)
      await fetchOrders(user.uid)
    } catch (error) {
      console.error('Error loading profile:', error)
      Alert.alert('Error', 'Failed to load profile')
    }
  }

  const fetchOrders = async (sellerId: string) => {
    setLoading(true)
    try {
      const fetchedOrders = await orderService.getOrders(sellerId)
      setOrders(fetchedOrders)
    } catch (error) {
      console.error('Error fetching orders:', error)
      Alert.alert('Error', 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const filterOrders = () => {
    let filtered = orders

    // Filter by status
    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => order.status === activeFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        order =>
          order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.orderId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredOrders(filtered)
  }

  const handleMarkAsReady = async (orderId: string) => {
    if (!auth.currentUser) return

    try {
      await orderService.updateOrderStatus(auth.currentUser.uid, orderId, 'ready')
      await fetchOrders(auth.currentUser.uid)
      Alert.alert('Success', 'Order marked as ready')
    } catch (error) {
      console.error('Error updating order:', error)
      Alert.alert('Error', 'Failed to update order')
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!auth.currentUser) return

    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await orderService.updateOrderStatus(auth.currentUser!.uid, orderId, 'cancelled')
              await fetchOrders(auth.currentUser!.uid)
              Alert.alert('Success', 'Order cancelled')
            } catch (error) {
              console.error('Error cancelling order:', error)
              Alert.alert('Error', 'Failed to cancel order')
            }
          },
        },
      ]
    )
  }

  const getStatusCount = (status: 'pending' | 'ready' | 'completed') => {
    return orders.filter(order => order.status === status).length
  }

  const getInitials = (name: string) => {
    const names = name.split(' ')
    return names.map(n => n.charAt(0).toUpperCase()).join('')
  }

  if (loading || !sellerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 200 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders Management</Text>
        <Text style={styles.headerSubtitle}>Track and manage customer orders</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textSoft} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order ID or customer name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSoft}
          />
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{getStatusCount('pending')}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {getStatusCount('ready')}
            </Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.textSoft }]}>
              {getStatusCount('completed')}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'pending' && styles.filterTabActive]}
            onPress={() => setActiveFilter('pending')}
          >
            <Text style={[styles.filterText, activeFilter === 'pending' && styles.filterTextActive]}>
              Pending
            </Text>
            {getStatusCount('pending') > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getStatusCount('pending')}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'ready' && styles.filterTabActive]}
            onPress={() => setActiveFilter('ready')}
          >
            <Text style={[styles.filterText, activeFilter === 'ready' && styles.filterTextActive]}>
              Ready
            </Text>
            {getStatusCount('ready') > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.filterBadgeText}>{getStatusCount('ready')}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'completed' && styles.filterTabActive]}
            onPress={() => setActiveFilter('completed')}
          >
            <Text style={[styles.filterText, activeFilter === 'completed' && styles.filterTextActive]}>
              Done
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <View style={styles.ordersContainer}>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No orders found</Text>
              <Text style={styles.emptySubtext}>Orders will appear here when customers place them</Text>
            </View>
          ) : (
            filteredOrders.map(order => (
              <View key={order.id} style={styles.orderCard}>
                {/* Customer Info */}
                <View style={styles.orderHeader}>
                  <View style={styles.customerInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(order.customerName)}</Text>
                    </View>
                    <View>
                      <Text style={styles.customerName}>{order.customerName}</Text>
                      <Text style={styles.orderId}>{order.orderId}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      order.status === 'pending' && { backgroundColor: '#000' },
                      order.status === 'ready' && { backgroundColor: colors.primary },
                      order.status === 'completed' && { backgroundColor: colors.textSoft },
                    ]}
                  >
                    <Clock size={12} color="#fff" />
                    <Text style={styles.statusText}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Order Details */}
                <View style={styles.orderDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mystery Bag:</Text>
                    <Text style={styles.detailValue}>{order.mysteryBag}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price:</Text>
                    <Text style={[styles.detailValue, { color: colors.primary }]}>
                      RM{order.total.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pickup Time:</Text>
                    <Text style={styles.detailValue}>{order.pickupTime}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ordered:</Text>
                    <Text style={styles.detailValue}>
                      {order.createdAt
                        ? new Date(order.createdAt.toDate()).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Phone */}
                <View style={styles.phoneContainer}>
                  <Phone size={16} color={colors.textSoft} />
                  <Text style={styles.phoneText}>{order.customerPhone}</Text>
                </View>

                {/* Actions */}
                {order.status === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryButton]}
                      onPress={() => handleMarkAsReady(order.id!)}
                    >
                      <Text style={styles.primaryButtonText}>Mark as Ready</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.secondaryButton]}
                      onPress={() => handleCancelOrder(order.id!)}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel Order</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSoft,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.text,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: colors.white,
  },
  filterText: {
    fontSize: 10,
    color: colors.text,
    fontWeight: '500',
  },
  filterTextActive: {
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: colors.text,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '600',
  },
  ordersContainer: {
    paddingHorizontal: spacing.lg,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  orderId: {
    fontSize: 12,
    color: colors.textSoft,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSoft,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  phoneText: {
    fontSize: 14,
    color: colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSoft,
  },
})