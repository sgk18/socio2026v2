const normalizeCategoryLabel = (value: unknown): string => String(value ?? "").trim();

const dedupeCategories = (values: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = normalizeCategoryLabel(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
};

export const toClubCategories = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return dedupeCategories(value.map((entry) => normalizeCategoryLabel(entry)));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return dedupeCategories(parsed.map((entry) => normalizeCategoryLabel(entry)));
        }
      } catch {
        // Fall through to legacy single-value handling.
      }
    }

    return dedupeCategories([trimmed]);
  }

  return [];
};

export const serializeClubCategories = (value: unknown): string | null => {
  const categories = toClubCategories(value);
  return categories.length > 0 ? JSON.stringify(categories) : null;
};
