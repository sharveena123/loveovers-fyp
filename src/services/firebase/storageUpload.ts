import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

export async function uploadImageFromUri(
  localUri: string,
  storagePath: string,
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storage = getStorage();
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
