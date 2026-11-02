import type { ImageMetadata } from 'astro';

// Documentary photos extracted from the team's research documents.
// Files live in src/assets/photos/<group>/<nn>.jpg and are referenced from the
// content YAML as "<group>/<nn>", e.g. `photo: pa-then/15`.
// Every photo must keep its credit; get permission before publishing publicly.
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*/*.{jpg,jpeg,png,webp}', { eager: true });

export const photos: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => {
    const key = path.replace('../assets/photos/', '').replace(/\.(jpe?g|png|webp)$/i, '');
    return [key, mod.default];
  }),
);

export function getPhoto(key: string | undefined): ImageMetadata | undefined {
  if (!key) return undefined;
  const found = photos[key];
  if (!found && import.meta.env.DEV) console.warn(`[photos] Missing photo "${key}"`);
  return found;
}
