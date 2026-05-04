const GOOGLE_DRIVE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
]);

const cleanHost = (host: string) => host.replace(/^www\./i, "").toLowerCase();

export const extractGoogleDriveFileId = (rawUrl: string): string | null => {
  const trimmed = String(rawUrl ?? "").trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = cleanHost(parsed.hostname);
    if (!GOOGLE_DRIVE_HOSTS.has(host)) return null;

    const idParam = parsed.searchParams.get("id");
    if (idParam) return idParam.trim();

    const pathMatch =
      parsed.pathname.match(/\/file\/d\/([^/]+)/i) ??
      parsed.pathname.match(/\/d\/([^/]+)/i);
    if (pathMatch?.[1]) return pathMatch[1].trim();
  } catch {
    return null;
  }

  return null;
};

const toGoogleDriveBannerCandidates = (fileId: string): string[] => {
  const id = encodeURIComponent(fileId);
  return [
    `https://drive.usercontent.google.com/download?id=${id}&export=view&authuser=0`,
    `https://drive.usercontent.google.com/uc?id=${id}&export=view`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2000`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://lh3.googleusercontent.com/d/${id}=w2000`,
  ];
};

export const getClubBannerCandidates = (
  rawUrl: string | null | undefined
): string[] => {
  const normalized = String(rawUrl ?? "").trim();
  if (!normalized) return [];

  const fileId = extractGoogleDriveFileId(normalized);
  if (!fileId) return [normalized];

  return Array.from(new Set([...toGoogleDriveBannerCandidates(fileId), normalized]));
};

export const normalizeClubBannerUrl = (
  rawUrl: string | null | undefined
): string | null => {
  const candidates = getClubBannerCandidates(rawUrl);
  return candidates[0] ?? null;
};
