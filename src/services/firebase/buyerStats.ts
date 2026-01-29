import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './config'

export interface BuyerStats {
  bagsSaved: number
  moneySaved: number
  co2Saved: number
}

export const getBuyerStats = async (buyerId: string): Promise<BuyerStats> => {
  try {
    // Get all completed orders for this buyer across all sellers
    const sellersSnapshot = await getDocs(collection(db, 'sellers'))
    
    let totalBags = 0
    let totalMoney = 0
    
    for (const sellerDoc of sellersSnapshot.docs) {
      const ordersRef = collection(db, 'sellers', sellerDoc.id, 'orders')
      const buyerOrdersQuery = query(
        ordersRef,
        where('customerId', '==', buyerId),
        where('status', '==', 'completed')
      )
      
      const ordersSnapshot = await getDocs(buyerOrdersQuery)
      
      ordersSnapshot.forEach(doc => {
        const data = doc.data()
        totalBags++
        totalMoney += data.total || 0
      })
    }
    
    // Calculate CO2 saved (average 7kg per bag)
    const co2Saved = totalBags * 7
    
    return {
      bagsSaved: totalBags,
      moneySaved: totalMoney,
      co2Saved,
    }
  } catch (error) {
    console.error('Error fetching buyer stats:', error)
    return {
      bagsSaved: 0,
      moneySaved: 0,
      co2Saved: 0,
    }
  }
}