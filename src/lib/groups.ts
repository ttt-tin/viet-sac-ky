import { getCollection, type CollectionEntry } from 'astro:content';

export type Group = CollectionEntry<'ethnicGroups'>;

/** All ethnic groups, in journey order (north to south). */
export async function getGroups(): Promise<Group[]> {
  const groups = await getCollection('ethnicGroups');
  return groups.sort((a, b) => a.data.order - b.data.order);
}

export const groupUrl = (id: string) => `/ethnic/${id}`;
