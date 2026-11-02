import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content blocks that can appear inside a section of an ethnic-group page.
 * Writers only edit the YAML files in src/content/ethnic-groups/.
 * Text fields support **bold** and *italic*; separate paragraphs with a blank line.
 */
/** A documentary photo: `photo` is "<group>/<nn>" (see src/data/photos.ts). */
const photoRef = z.object({ photo: z.string(), caption: z.string(), credit: z.string() });

const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), body: z.string() }),
  z.object({ type: z.literal('did'), title: z.string().default('Bạn có biết?'), body: z.string() }),
  z.object({
    type: z.literal('cards'),
    title: z.string().optional(),
    columns: z.number().int().min(1).max(4).default(3),
    items: z.array(
      z.object({
        name: z.string(),
        sub: z.string().optional(),
        body: z.string().optional(),
        photo: z.string().optional(),
        credit: z.string().optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal('steps'),
    title: z.string().optional(),
    items: z.array(
      z.object({ title: z.string(), body: z.string(), photo: z.string().optional(), credit: z.string().optional() }),
    ),
  }),
  z.object({
    type: z.literal('compare'),
    title: z.string().optional(),
    items: z.array(z.object({ title: z.string(), points: z.array(z.string()) })),
  }),
  z.object({
    type: z.literal('phrases'),
    title: z.string().optional(),
    items: z.array(z.object({ local: z.string(), vi: z.string() })),
  }),
  z.object({ type: z.literal('list'), title: z.string().optional(), items: z.array(z.string()) }),
  z.object({ type: z.literal('badge'), text: z.string() }),
  z.object({
    type: z.literal('figure'),
    photo: z.string().optional(),
    illustration: z.string().optional(),
    placeholder: z.boolean().default(false),
    caption: z.string(),
    credit: z.string().optional(),
  }),
  z.object({
    type: z.literal('gallery'),
    title: z.string().optional(),
    items: z.array(photoRef).min(1),
  }),
]);

const ethnicGroups = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/ethnic-groups' }),
  schema: z.object({
    name: z.string(),
    autonym: z.string().optional(),
    order: z.number().int(),
    symbol: z.string(),
    accent: z.enum(['ha-nhi', 'pa-then', 'ede']),
    illustration: z.string(),
    heroPhoto: photoRef.optional(),
    tagline: z.string(),
    intro: z.string(),
    map: z.object({ lon: z.number(), lat: z.number(), label: z.enum(['left', 'right']).default('right') }),
    facts: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().optional() })),
    sections: z.array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string(),
        short: z.string(),
        blocks: z.array(block),
      }),
    ),
    quiz: z
      .array(z.object({ question: z.string(), options: z.array(z.string()).min(2), answer: z.number().int().min(0) }))
      .min(1),
    chat: z.object({ greeting: z.string(), suggestions: z.array(z.string()).max(4) }),
    sources: z.array(z.object({ title: z.string(), url: z.string().url().optional() })),
  }),
});

export const collections = { ethnicGroups };
