import { db } from '@/src/services/firebase/config'
import { addDoc, collection, Timestamp } from 'firebase/firestore'

export const addMockOrders = async (sellerId: string) => {
  const orders = [
    {
      sellerId,
      customerId: 'customer1',
      customerName: 'Sarah Johnson',
      customerPhone: '+1 (555) 123-4567',
      orderId: 'ORD-1234',
      mysteryBag: 'Breakfast Special',
      total: 4.99,
      status: 'pending',
      pickupTime: '10:00 AM - 11:00 AM',
      items: [{ itemId: 'item1', itemName: 'Breakfast Special', quantity: 1, price: 4.99 }],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      sellerId,
      customerId: 'customer2',
      customerName: 'Emma Davis',
      customerPhone: '+1 (555) 345-6789',
      orderId: 'ORD-1236',
      mysteryBag: 'Bread Bundle',
      total: 3.99,
      status: 'pending',
      pickupTime: '2:00 PM - 3:00 PM',
      items: [{ itemId: 'item2', itemName: 'Bread Bundle', quantity: 1, price: 3.99 }],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ]

  const ordersRef = collection(db, 'sellers', sellerId, 'orders')
  
  for (const order of orders) {
    await addDoc(ordersRef, order)
  }
  
  console.log('Mock orders added successfully!')
}