import { db } from '@/src/services/firebase/config'
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'

export type UserRole = 'buyer' | 'seller'

export interface OperatingHours {
  monday: string
  tuesday: string
  wednesday: string
  thursday: string
  friday: string
  saturday: string
  sunday: string
}

export interface BusinessSettings {
  notifications: boolean
  lowStockAlerts: boolean
}

export interface BuyerProfile {
  uid: string
  email: string
  role: 'buyer'
  fullName: string
  phone: string
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
}

export interface SellerProfile {
  uid: string
  email: string
  role: 'seller'
  contactName: string
  businessName: string
  phone: string
  businessAddress: string
  tier?: 'Free' | 'Premium' | 'Premium Seller'
  operatingHours?: OperatingHours
  settings?: BusinessSettings
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
}

export type UserProfile = BuyerProfile | SellerProfile

// Create buyer profile
export async function createBuyerProfile(
  uid: string,
  email: string,
  fullName: string,
  phone: string
) {
  const profile: BuyerProfile = {
    uid,
    email,
    role: 'buyer',
    fullName,
    phone,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }

  await setDoc(doc(db, 'users', uid), profile)
  return profile
}

// Create seller profile
export async function createSellerProfile(
  uid: string,
  email: string,
  contactName: string,
  businessName: string,
  phone: string,
  businessAddress: string
) {
  const profile: SellerProfile = {
    uid,
    email,
    role: 'seller',
    contactName,
    businessName,
    phone,
    businessAddress,
    tier: 'Premium Seller',
    operatingHours: {
      monday: '7:00 AM - 8:00 PM',
      tuesday: '7:00 AM - 8:00 PM',
      wednesday: '7:00 AM - 8:00 PM',
      thursday: '7:00 AM - 8:00 PM',
      friday: '7:00 AM - 8:00 PM',
      saturday: '8:00 AM - 9:00 PM',
      sunday: '9:00 AM - 6:00 PM',
    },
    settings: {
      notifications: true,
      lowStockAlerts: true,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }

  await setDoc(doc(db, 'users', uid), profile)
  
  // Also create seller business document
  await setDoc(doc(db, 'sellers', uid), {
    uid,
    businessName,
    contactName,
    businessAddress,
    phone,
    email,
    isActive: true,
    tier: 'Premium Seller',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return profile
}

// Get user profile
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) return null

  return snap.data() as UserProfile
}

// Update seller settings
export async function updateSellerSettings(
  uid: string,
  settings: Partial<BusinessSettings>
): Promise<void> {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, {
    'settings': settings,
    updatedAt: Timestamp.now(),
  })
}

// Update operating hours
export async function updateOperatingHours(
  uid: string,
  hours: Partial<OperatingHours>
): Promise<void> {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, {
    'operatingHours': hours,
    updatedAt: Timestamp.now(),
  })
}