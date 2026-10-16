export function userPhotoPublicUrl(photoName: string): string {
  const name = String(photoName || "").trim();
  // Always hit the account photo route so files named by user id still resolve.
  return name ? `/api/account/photo?v=${encodeURIComponent(name)}` : "/api/account/photo";
}
