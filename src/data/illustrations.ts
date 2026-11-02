import type { ImageMetadata } from 'astro';
import hero from '../assets/illustrations/hero.jpg';
import haNhi from '../assets/illustrations/ha-nhi.jpg';
import paThen from '../assets/illustrations/pa-then.jpg';
import ede from '../assets/illustrations/ede.jpg';

// Placeholder watercolor-style illustrations. Replace the files in
// src/assets/illustrations/ with the final artwork (same names) when ready.
export const illustrations: Record<string, ImageMetadata> = {
  hero,
  'ha-nhi': haNhi,
  'pa-then': paThen,
  ede,
};

export function getIllustration(key: string | undefined): ImageMetadata | undefined {
  return key ? illustrations[key] : undefined;
}
