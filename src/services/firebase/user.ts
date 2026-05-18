import { db } from "@/src/services/firebase/config";
import * as Location from "expo-location";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";

export type UserRole = "buyer" | "seller";

export interface OperatingHours {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface BusinessSettings {
  notifications: boolean;
  lowStockAlerts: boolean;
}

export interface BuyerProfile {
  uid: string;
  email: string;
  role: "buyer";
  fullName: string;
  phone: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface BuyerPreferences {
  uid: string;
  pushNotifications: boolean;
  emailNotifications: boolean;
  searchRadius: number; // in km
  autoRefresh: boolean;
  darkMode: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface SellerProfile {
  uid: string;
  email: string;
  role: "seller";
  contactName: string;
  businessName: string;
  phone: string;
  businessAddress: string;
  tier?: "Free" | "Premium" | "Premium Seller";
  cafeId?: string;
  operatingHours?: OperatingHours;
  settings?: BusinessSettings;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export type UserProfile = BuyerProfile | SellerProfile;

// Create buyer profile
export async function createBuyerProfile(
  uid: string,
  email: string,
  fullName: string,
  phone: string,
) {
  const profile: BuyerProfile = {
    uid,
    email,
    role: "buyer",
    fullName,
    phone,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(doc(db, "users", uid), profile);
  return profile;
}

// Create seller profile
export async function createSellerProfile(
  uid: string,
  email: string,
  contactName: string,
  businessName: string,
  phone: string,
  businessAddress: string,
) {
  let resolvedLatitude: number | undefined;
  let resolvedLongitude: number | undefined;

  try {
    const geocodeResults = await Location.geocodeAsync(businessAddress);
    if (geocodeResults.length > 0) {
      resolvedLatitude = geocodeResults[0].latitude;
      resolvedLongitude = geocodeResults[0].longitude;
    }
  } catch (error) {
    console.error("Failed to geocode seller address:", error);
  }

  const profile: SellerProfile = {
    uid,
    email,
    role: "seller",
    contactName,
    businessName,
    phone,
    businessAddress,
    tier: "Premium Seller",
    operatingHours: {
      monday: "7:00 AM - 8:00 PM",
      tuesday: "7:00 AM - 8:00 PM",
      wednesday: "7:00 AM - 8:00 PM",
      thursday: "7:00 AM - 8:00 PM",
      friday: "7:00 AM - 8:00 PM",
      saturday: "8:00 AM - 9:00 PM",
      sunday: "9:00 AM - 6:00 PM",
    },
    settings: {
      notifications: true,
      lowStockAlerts: true,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(doc(db, "users", uid), profile);

  // Also create seller business document
  const sellerDoc: Record<string, unknown> = {
    uid,
    businessName,
    contactName,
    businessAddress,
    phone,
    email,
    isActive: true,
    tier: "Premium Seller",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (
    typeof resolvedLatitude === "number" &&
    typeof resolvedLongitude === "number"
  ) {
    sellerDoc.latitude = resolvedLatitude;
    sellerDoc.longitude = resolvedLongitude;
  }

  await setDoc(doc(db, "sellers", uid), sellerDoc);

  return profile;
}

// Get user profile
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data() as UserProfile;
}

// Update seller settings
export async function updateSellerSettings(
  uid: string,
  settings: Partial<BusinessSettings>,
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    settings: settings,
    updatedAt: Timestamp.now(),
  });
}

// Update operating hours
export async function updateOperatingHours(
  uid: string,
  hours: Partial<OperatingHours>,
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    operatingHours: hours,
    updatedAt: Timestamp.now(),
  });
}

// Update buyer profile
export async function updateBuyerProfile(
  uid: string,
  updates: Partial<BuyerProfile>,
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

// Update seller profile
export async function updateSellerProfile(
  uid: string,
  updates: Partial<SellerProfile>,
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

// Generic update user profile
export async function updateUserProfile(
  uid: string,
  updates: Record<string, any>,
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

// Get buyer preferences
export async function getBuyerPreferences(
  uid: string,
): Promise<BuyerPreferences | null> {
  try {
    const ref = doc(db, "users", uid, "preferences", "settings");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Return default preferences if not found
      return {
        uid,
        pushNotifications: true,
        emailNotifications: true,
        searchRadius: 10,
        autoRefresh: true,
        darkMode: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    }

    return snap.data() as BuyerPreferences;
  } catch (error) {
    console.error("Error fetching buyer preferences:", error);
    return null;
  }
}

// Update buyer preferences
export async function updateBuyerPreferences(
  uid: string,
  preferences: Partial<BuyerPreferences>,
): Promise<void> {
  const ref = doc(db, "users", uid, "preferences", "settings");
  
  try {
    // Check if document exists
    const snap = await getDoc(ref);
    
    if (snap.exists()) {
      // Update existing preferences
      await updateDoc(ref, {
        ...preferences,
        updatedAt: Timestamp.now(),
      });
    } else {
      // Create new preferences document
      await setDoc(ref, {
        uid,
        pushNotifications: true,
        emailNotifications: true,
        searchRadius: 10,
        autoRefresh: true,
        darkMode: false,
        ...preferences,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error("Error updating buyer preferences:", error);
    throw error;
  }
}
