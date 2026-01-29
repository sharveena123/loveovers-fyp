import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './config'
import { InventoryItem } from './inventoryServices'

export interface AvailableBag extends InventoryItem {
  sellerId: string
  sellerName: string
  distance: number
  rating: number
}

export const getAvailableBags = async (): Promise<AvailableBag[]> => {
  try {
    const bags: AvailableBag[] = []
    
    // Get all sellers
    const sellersSnapshot = await getDocs(collection(db, 'sellers'))
    
    for (const sellerDoc of sellersSnapshot.docs) {
      const sellerData = sellerDoc.data()
      
      // Get active inventory for this seller
      const inventoryRef = collection(db, 'sellers', sellerDoc.id, 'inventory')
      const activeQuery = query(
        inventoryRef,
        where('status', 'in', ['active', 'fresh', 'expiring'])
      )
      
      const inventorySnapshot = await getDocs(activeQuery)
      
      inventorySnapshot.forEach(doc => {
        const item = doc.data() as InventoryItem
        
        // Only include items with available quantity
        if ((item.quantity - (item.sold || 0)) > 0) {
          bags.push({
            ...item,
            id: doc.id,
            sellerId: sellerDoc.id,
            sellerName: sellerData.businessName || 'Unknown Seller',
            distance: Math.random() * 2, // TODO: Calculate real distance
            rating: 4.8, // TODO: Get real rating
          })
        }
      })
    }
    
    // Sort by distance
    return bags.sort((a, b) => a.distance - b.distance)
  } catch (error) {
    console.error('Error fetching available bags:', error)
    return []
  }
}