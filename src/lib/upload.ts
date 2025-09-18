import { storage } from "@/lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export async function uploadLogo(file: File, userUid: string): Promise<string> {
  const path = `profiles/${userUid}/logo-${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(snapshot.ref);
  return url;
} 