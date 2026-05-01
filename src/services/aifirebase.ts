// src/services/firebase.ts

import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

/**
 * Upload CSV file to Firebase Storage
 */
export const uploadCSVToFirebase = async (uri: string, fileName: string) => {
  try {
    const reference = storage().ref(`/datasets/${fileName}`);

    await reference.putFile(uri);

    const downloadURL = await reference.getDownloadURL();

    // Save metadata in Firestore
    await firestore().collection("uploads").add({
      fileName,
      url: downloadURL,
      createdAt: new Date(),
    });

    console.log("File uploaded successfully");
  } catch (error) {
    console.log("Firebase upload error:", error);
  }
};
