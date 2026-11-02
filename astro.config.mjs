// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// Pages are pre-rendered as static HTML. Only /api/chat runs on demand
// (it sets `export const prerender = false`), so an adapter is required.
// To deploy on Netlify or Cloudflare instead, swap the adapter here.
export default defineConfig({
  site: 'https://viet-sac-ky.vercel.app',
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'ignore',
  env: {
    schema: {
      // Secrets are read at runtime on the server and never sent to the browser.
      ANTHROPIC_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      AI_MODEL: envField.string({ context: 'server', access: 'secret', optional: true, default: 'claude-haiku-5-5' }),
      CHAT_RATE_LIMIT: envField.number({ context: 'server', access: 'secret', optional: true, default: 20 }),
    },
  },
});
