import { auth, db } from "@/src/services/firebase/config";
import {
  uploadImageFromUri,
  uploadImagesFromUris,
} from "@/src/services/firebase/storageUpload";
import type { SellerProfile } from "@/src/services/firebase/user";
import * as Location from "expo-location";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";

export type SellerVerificationType =
  | "business_verified"
  | "manual_verification";

export type SellerVerificationStatus =
  | "pending_review"
  | "approved"
  | "rejected";

export interface BusinessVerificationPayload {
  ssmRegistrationNumber: string;
  businessAddress: string;
  googleMapsLink: string;
  storefrontImageUri: string;
}

export interface ManualVerificationPayload {
  workspacePhotoUris: string[];
  sampleProductPhotoUris: string[];
  socialMediaLink: string;
  businessDescription: string;
}

export interface RegisterSellerInput {
  email: string;
  password: string;
  contactName: string;
  businessName: string;
  phone: string;
  businessAddress: string;
  profileImageUri: string;
  verificationType: SellerVerificationType;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  business?: BusinessVerificationPayload;
  manual?: ManualVerificationPayload;
}

export function getSellerPostAuthRoute(
  profile: SellerProfile,
): "/(auth)/seller-pending" | "/(seller)/(tabs)/dashboard" {
  if (
    profile.verificationStatus === "pending_review" ||
    profile.verificationStatus === "rejected"
  ) {
    return "/(auth)/seller-pending";
  }
  return "/(seller)/(tabs)/dashboard";
}

export async function registerSellerAccount(
  input: RegisterSellerInput,
): Promise<{ uid: string; profile: SellerProfile }> {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );
  const uid = userCredential.user.uid;
  const storageBase = `sellers/${uid}/verification`;

  const profileImageUrl = await uploadImageFromUri(
    input.profileImageUri,
    `${storageBase}/profile_${Date.now()}.jpg`,
  );

  let verificationStatus: SellerVerificationStatus = "approved";
  let businessVerification: SellerProfile["businessVerification"];
  let manualVerification: SellerProfile["manualVerification"];

  if (input.verificationType === "business_verified" && input.business) {
    const storefrontImageUrl = await uploadImageFromUri(
      input.business.storefrontImageUri,
      `${storageBase}/storefront_${Date.now()}.jpg`,
    );
    businessVerification = {
      ssmRegistrationNumber: input.business.ssmRegistrationNumber.trim(),
      businessAddress: input.business.businessAddress.trim(),
      googleMapsLink: input.business.googleMapsLink.trim(),
      storefrontImageUrl,
    };
    verificationStatus = "approved";
  } else if (input.verificationType === "manual_verification" && input.manual) {
    const workspacePhotoUrls = await uploadImagesFromUris(
      input.manual.workspacePhotoUris,
      `${storageBase}/workspace`,
    );
    const sampleProductPhotoUrls = await uploadImagesFromUris(
      input.manual.sampleProductPhotoUris,
      `${storageBase}/samples`,
    );
    manualVerification = {
      workspacePhotoUrls,
      sampleProductPhotoUrls,
      socialMediaLink: input.manual.socialMediaLink.trim(),
      businessDescription: input.manual.businessDescription.trim(),
    };
    verificationStatus = "pending_review";
  } else {
    throw new Error("Verification details are required");
  }

  let resolvedLatitude = input.latitude;
  let resolvedLongitude = input.longitude;
  const addressForGeocode =
    input.business?.businessAddress.trim() || input.businessAddress.trim();

  if (
    typeof resolvedLatitude !== "number" ||
    typeof resolvedLongitude !== "number"
  ) {
    try {
      const geocodeResults = await Location.geocodeAsync(addressForGeocode);
      if (geocodeResults.length > 0) {
        resolvedLatitude = geocodeResults[0].latitude;
        resolvedLongitude = geocodeResults[0].longitude;
      }
    } catch (error) {
      console.warn("Seller geocode failed:", error);
    }
  }

  const now = Timestamp.now();
  const profile: SellerProfile = {
    uid,
    email: input.email.trim(),
    role: "seller",
    contactName: input.contactName.trim(),
    businessName: input.businessName.trim(),
    phone: input.phone.trim(),
    businessAddress: addressForGeocode,
    profileImageUrl,
    verificationType: input.verificationType,
    verificationStatus,
    businessVerification,
    manualVerification,
    tier: "Free",
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
    createdAt: now,
    updatedAt: now,
    verificationSubmittedAt: now,
  };

  await setDoc(doc(db, "users", uid), profile);

  const sellerDoc: Record<string, unknown> = {
    uid,
    businessName: profile.businessName,
    contactName: profile.contactName,
    businessAddress: profile.businessAddress,
    phone: profile.phone,
    email: profile.email,
    profileImageUrl,
    verificationType: input.verificationType,
    verificationStatus,
    businessVerification,
    manualVerification,
    googlePlaceId: input.googlePlaceId,
    isActive: verificationStatus === "approved",
    tier: "Free",
    createdAt: now,
    updatedAt: now,
    verificationSubmittedAt: now,
  };

  if (
    typeof resolvedLatitude === "number" &&
    typeof resolvedLongitude === "number"
  ) {
    sellerDoc.latitude = resolvedLatitude;
    sellerDoc.longitude = resolvedLongitude;
  }

  await setDoc(doc(db, "sellers", uid), sellerDoc);

  await setDoc(doc(db, "sellerVerifications", uid), {
    uid,
    businessName: profile.businessName,
    contactName: profile.contactName,
    email: profile.email,
    phone: profile.phone,
    verificationType: input.verificationType,
    verificationStatus,
    businessVerification,
    manualVerification,
    profileImageUrl,
    submittedAt: now,
    updatedAt: now,
  });

  return { uid, profile };
}
