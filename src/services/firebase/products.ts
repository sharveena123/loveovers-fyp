// src/services/firebase/products.ts
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    updateDoc,
} from 'firebase/firestore';
import { db } from './config';

export const getSellerProducts = async (sellerId: string) => {
  const productsCol = collection(db, 'sellers', sellerId, 'products');
  const snapshot = await getDocs(productsCol);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addProduct = async (sellerId: string, product: any) => {
  const productsCol = collection(db, 'sellers', sellerId, 'products');
  const docRef = await addDoc(productsCol, { ...product, createdAt: new Date() });
  return docRef.id;
};

export const updateProduct = async (sellerId: string, productId: string, data: any) => {
  const docRef = doc(db, 'sellers', sellerId, 'products', productId);
  await updateDoc(docRef, data);
};

export const deleteProduct = async (sellerId: string, productId: string) => {
  const docRef = doc(db, 'sellers', sellerId, 'products', productId);
  await deleteDoc(docRef);
};
