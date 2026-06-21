import { db } from "@/src/services/firebase/config";
import * as Location from "expo-location";
import {
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

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

export type SellerVerificationType =
  | "business_verified"
  | "manual_verification";

export type SellerVerificationStatus =
  | "pending_review"
  | "approved"
  | "rejected";

export interface BusinessVerificationData {
  ssmRegistrationNumber: string;
  businessAddress: string;
  googleMapsLink: string;
  storefrontImageUrl: string;
}

export interface ManualVerificationData {
  workspacePhotoUrls: string[];
  sampleProductPhotoUrls: string[];
  socialMediaLink: string;
  businessDescription: string;
}

export type SellerPhoneChangeStatus = "pending" | "approved" | "rejected";

export type SellerLocationEditPermissionStatus =
  | "pending"
  | "approved"
  | "rejected";

export type SellerLocationChangeStatus = "pending" | "approved" | "rejected";

export interface SellerProfile {
  uid: string;
  email: string;
  role: "seller";
  contactName: string;
  businessName: string;
  phone: string;
  businessAddress: string;
  /** New number awaiting manual admin approval (does not replace `phone` until approved). */
  pendingPhone?: string;
  pendingPhoneStatus?: SellerPhoneChangeStatus;
  pendingPhoneSubmittedAt?: Timestamp | Date;
  /** Seller asked admin for permission to edit their location. */
  locationEditPermissionStatus?: SellerLocationEditPermissionStatus;
  locationEditPermissionRequestedAt?: Timestamp | Date;
  locationEditPermissionReviewedAt?: Timestamp | Date;
  locationEditPermissionReviewNote?: string;
  /** Proposed location awaiting admin approval (active address unchanged until approved). */
  pendingLocationStatus?: SellerLocationChangeStatus;
  pendingBusinessAddress?: string;
  pendingLatitude?: number;
  pendingLongitude?: number;
  pendingGooglePlaceId?: string;
  pendingGoogleMapsLink?: string;
  pendingLocationSubmittedAt?: Timestamp | Date;
  pendingLocationReviewedAt?: Timestamp | Date;
  pendingLocationReviewNote?: string;
  profileImageUrl?: string;
  verificationType?: SellerVerificationType;
  verificationStatus?: SellerVerificationStatus;
  businessVerification?: BusinessVerificationData;
  manualVerification?: ManualVerificationData;
  verificationSubmittedAt?: Timestamp | Date;
  verificationReviewedAt?: Timestamp | Date;
  verificationReviewNote?: string;
  tier?: "Free" | "Premium" | "Premium Seller";
  cafeId?: string;
  operatingHours?: OperatingHours;
  settings?: BusinessSettings;
  /** 12–23: hour when closing-window markdown peaks (local device time). Default 20. */
  smartPricingClosingHour?: number;
  /** Master switch: new mystery bags default to smart pricing when true. */
  smartPricingStoreDefault?: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export type UserProfile = BuyerProfile | SellerProfile;

const SELLER_MIRROR_FIELDS = [
  "businessAddress",
  "phone",
  "verificationStatus",
  "verificationType",
  "pendingPhone",
  "pendingPhoneStatus",
  "pendingPhoneSubmittedAt",
  "pendingLocationStatus",
  "pendingBusinessAddress",
  "pendingLatitude",
  "pendingLongitude",
  "pendingGooglePlaceId",
  "pendingGoogleMapsLink",
  "pendingLocationSubmittedAt",
  "pendingLocationReviewedAt",
  "pendingLocationReviewNote",
  "locationEditPermissionStatus",
  "locationEditPermissionRequestedAt",
  "locationEditPermissionReviewedAt",
  "locationEditPermissionReviewNote",
] as const;

function mergeSellerMirror(
  profile: SellerProfile,
  sellerData: Record<string, unknown>,
): SellerProfile {
  const merged: SellerProfile = { ...profile };
  for (const key of SELLER_MIRROR_FIELDS) {
    if (sellerData[key] !== undefined) {
      (merged as Record<string, unknown>)[key] = sellerData[key];
    }
  }
  return merged;
}

export function isSellerLocationChangePending(
  profile: SellerProfile,
): boolean {
  const pendingAddress = profile.pendingBusinessAddress?.trim();
  if (profile.pendingLocationStatus !== "pending" || !pendingAddress) {
    return false;
  }
  return pendingAddress !== profile.businessAddress.trim();
}

export function isSellerPhoneChangePending(profile: SellerProfile): boolean {
  const pendingPhone = profile.pendingPhone?.trim();
  if (profile.pendingPhoneStatus !== "pending" || !pendingPhone) {
    return false;
  }
  return pendingPhone !== profile.phone.trim();
}

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

async function readDocFresh(ref: ReturnType<typeof doc>) {
  try {
    return await getDocFromServer(ref);
  } catch {
    return await getDoc(ref);
  }
}

// Get user profile (server-first; sellers doc merged for admin-updated fields)
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await readDocFresh(ref);

  if (!snap.exists()) return null;

  const profile = snap.data() as UserProfile;

  if (profile.role !== "seller") {
    return profile;
  }

  try {
    const sellerSnap = await readDocFresh(doc(db, "sellers", uid));
    if (!sellerSnap.exists()) {
      return profile;
    }
    return mergeSellerMirror(profile as SellerProfile, sellerSnap.data());
  } catch (error) {
    console.warn("Could not load sellers mirror for profile:", uid, error);
    return profile;
  }
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

  // Buyer feed reads `sellers/{id}` — mirror smart-pricing fields so live markdown matches dashboard.
  const sellerMirror: Record<string, unknown> = {};
  if ("smartPricingClosingHour" in updates) {
    sellerMirror.smartPricingClosingHour = updates.smartPricingClosingHour;
  }
  if ("smartPricingStoreDefault" in updates) {
    sellerMirror.smartPricingStoreDefault = updates.smartPricingStoreDefault;
  }
  if (Object.keys(sellerMirror).length > 0) {
    sellerMirror.updatedAt = Timestamp.now();
    await setDoc(doc(db, "sellers", uid), sellerMirror, { merge: true });
  }
}

/**
 * Queue a phone-number change for manual admin approval in Firestore.
 * The live `phone` field stays unchanged until admin approves in Firebase Console.
 *
 * Firebase admin — approve phone (users/{uid} + sellers/{uid}):
 * - phone = pendingPhone
 * - pendingPhoneStatus = "approved"
 * - delete pendingPhone, pendingPhoneSubmittedAt
 */
export async function requestSellerPhoneChange(
  uid: string,
  newPhone: string,
): Promise<void> {
  const trimmed = newPhone.trim();
  if (!trimmed) {
    throw new Error("Phone number is required");
  }

  const now = Timestamp.now();
  const payload = {
    pendingPhone: trimmed,
    pendingPhoneStatus: "pending" as const,
    pendingPhoneSubmittedAt: now,
    updatedAt: now,
  };

  await updateDoc(doc(db, "users", uid), payload);
  await setDoc(doc(db, "sellers", uid), payload, { merge: true });
}

export interface SellerLocationChangeInput {
  businessAddress: string;
  latitude: number;
  longitude: number;
  googlePlaceId: string;
  googleMapsLink: string;
}

/**
 * Submit a new Google Maps location for one-step admin approval.
 * Active address/coordinates stay until admin approves in Firebase Console.
 *
 * Firebase admin — approve location (users/{uid} + sellers/{uid}):
 * - businessAddress = pendingBusinessAddress
 * - latitude = pendingLatitude, longitude = pendingLongitude (sellers doc)
 * - googlePlaceId = pendingGooglePlaceId (sellers doc)
 * - pendingLocationStatus = "approved"
 * - delete: pendingBusinessAddress, pendingLatitude, pendingLongitude,
 *   pendingGooglePlaceId, pendingGoogleMapsLink, pendingLocationSubmittedAt
 * - optional: delete legacy locationEditPermission* fields if present
 * - business-verified sellers: also set businessVerification.businessAddress
 *   and businessVerification.googleMapsLink from pending values
 *
 * Firebase admin — reject location:
 * - pendingLocationStatus = "rejected"
 * - pendingLocationReviewNote = reason (optional)
 */
export async function requestSellerLocationChange(
  uid: string,
  input: SellerLocationChangeInput,
): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile || profile.role !== "seller") {
    throw new Error("Seller profile not found");
  }

  const seller = profile as SellerProfile;
  if (seller.pendingLocationStatus === "pending") {
    throw new Error("A location change is already pending admin approval");
  }

  const trimmedAddress = input.businessAddress.trim();
  if (!trimmedAddress) {
    throw new Error("Location is required");
  }
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude)
  ) {
    throw new Error("Valid map coordinates are required");
  }
  if (!input.googlePlaceId?.trim()) {
    throw new Error("Select a valid location from Google Maps");
  }
  if (!input.googleMapsLink?.trim()) {
    throw new Error("A Google Maps link is required");
  }

  const now = Timestamp.now();
  const payload: Record<string, unknown> = {
    pendingLocationStatus: "pending",
    pendingBusinessAddress: trimmedAddress,
    pendingLatitude: input.latitude,
    pendingLongitude: input.longitude,
    pendingGooglePlaceId: input.googlePlaceId.trim(),
    pendingGoogleMapsLink: input.googleMapsLink.trim(),
    pendingLocationSubmittedAt: now,
    locationEditPermissionStatus: deleteField(),
    locationEditPermissionRequestedAt: deleteField(),
    locationEditPermissionReviewedAt: deleteField(),
    locationEditPermissionReviewNote: deleteField(),
    updatedAt: now,
  };

  await updateDoc(doc(db, "users", uid), payload);
  await setDoc(doc(db, "sellers", uid), payload, { merge: true });
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
