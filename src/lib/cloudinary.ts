const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export async function uploadImageToCloudinaryDetailed(file: File, folder: string = "uploads"): Promise<{ url: string; publicId?: string; deleteToken?: string; }> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary non configuré: définissez VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET");
  }
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", folder);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échec upload Cloudinary: ${res.status} ${text}`);
  }
  const json = await res.json();
  return { url: json.secure_url as string, publicId: json.public_id as (string | undefined), deleteToken: json.delete_token as (string | undefined) };
}

export async function uploadImageToCloudinary(file: File, folder: string = "uploads"): Promise<string> {
  const { url } = await uploadImageToCloudinaryDetailed(file, folder);
  return url;
}

export async function deleteImageByToken(deleteToken: string): Promise<void> {
  if (!CLOUD_NAME) throw new Error("Cloudinary non configuré");
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`;
  const form = new FormData();
  form.append("token", deleteToken);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    // delete token peut expirer; on ignore l'erreur pour ne pas bloquer l'UX
  }
} 