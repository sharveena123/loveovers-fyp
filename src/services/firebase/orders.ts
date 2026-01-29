// src/services/firebase/orders.ts
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './config';

export const getSellerOrders = async (sellerId: string) => {
  const ordersCol = collection(db, 'sellers', sellerId, 'orders');
  const snapshot = await getDocs(ordersCol);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateOrderStatus = async (sellerId: string, orderId: string, status: string) => {
  const docRef = doc(db, 'sellers', sellerId, 'orders', orderId);
  await updateDoc(docRef, { status });
};
