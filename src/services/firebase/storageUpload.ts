import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/src/services/firebase/config";

/** Reliable blob fetch for React Native file:// and content:// URIs. */
async function blobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (response.ok) {
    const blob = await response.blob();
    if (blob.size > 0) return blob;
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      const blob = xhr.response;
      if (blob && blob.size > 0) {
        resolve(blob);
      } else {
        reject(new Error("Could not read image file"));
      }
    };
    xhr.onerror = () => reject(new Error("Could not read image file"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

export async function uploadImageFromUri(
  localUri: string,
  storagePath: string,
): Promise<string> {
  const blob = await blobFromUri(localUri);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function uploadImagesFromUris(
  uris: string[],
  pathPrefix: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    const url = await uploadImageFromUri(
      uris[i],
      `${pathPrefix}/${Date.now()}_${i}.jpg`,
    );
    urls.push(url);
  }
  return urls;
}
