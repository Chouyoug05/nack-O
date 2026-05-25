export function publicAssetUrl(assetPath: string): string {
  const cleanPath = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  const base = import.meta.env.BASE_URL || "/";

  if (base === "/") return `/${cleanPath}`;

  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${cleanPath}`;
}
