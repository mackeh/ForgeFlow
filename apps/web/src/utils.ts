export function imagePathToUrl(apiUrl: string, imagePath?: string) {
  if (!imagePath) return null;
  const normalized = imagePath.replace(/\\/g, "/");
  const marker = "/recordings/";
  if (normalized.includes("/app/recordings/")) {
    const rel = normalized.split("/app/recordings/")[1];
    return `${apiUrl}/recordings/${encodeURI(rel)}`;
  }
  if (normalized.includes(marker)) {
    const rel = normalized.split(marker)[1];
    return `${apiUrl}/recordings/${encodeURI(rel)}`;
  }
  return null;
}
