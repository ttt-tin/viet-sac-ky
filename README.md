# Việt Sắc Ký

An online "mini museum" that takes visitors on a journey through the cultures of three
Vietnamese ethnic groups: **Hà Nhì** (Mây), **Pà Thẻn** (Lửa) and **Ê Đê** (Đất).
Site content is in Vietnamese; code, comments and docs are in English.

Built with [Astro](https://astro.build): pages are static HTML; only the AI chat guide
(`/api/chat`) runs on the server.

## Requirements

- Node.js 18.20.8+ (LTS 20 or 22 recommended) and npm
- Git
- Optional, for the chat guide: a Gemini API key (free tier) or a Claude API key

## Getting started

```bash
npm install
cp .env.example .env      # then paste your GEMINI_API_KEY (optional)
npm run dev               # http://localhost:4321
```

Other scripts:

| Command           | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Local dev server with hot reload               |
| `npm run build`   | Production build (static pages + chat function) |
| `npm run preview` | Preview the production build locally           |

Without an API key the whole site works; the chat guide just replies that it is not connected yet.

## Pages

| URL                | File                          | Purpose                                         |
| ------------------ | ----------------------------- | ----------------------------------------------- |
| `/`                | `src/pages/index.astro`       | Intro "book cover" with the start button        |
| `/home`            | `src/pages/home.astro`        | About, illustrated map, postcards, passport     |
| `/ethnic/<slug>`   | `src/pages/ethnic/[slug].astro` | One room per ethnic group (shared template)   |
| `/thank-you`       | `src/pages/thank-you.astro`   | Closing message, thanks, project info, sources  |
| `/api/chat`        | `src/pages/api/chat.ts`       | AI guide endpoint (server-side, streaming)      |
| any other          | `src/pages/404.astro`         | "Lost in the mountains" page                    |

## Editing content (no coding needed)

Each ethnic group is one YAML file in `src/content/ethnic-groups/`:
`ha-nhi.yaml`, `pa-then.yaml`, `ede.yaml`. The schema lives in `src/content.config.ts`, so a
typo or missing field is reported when you run `npm run dev` or `npm run build`.

- `sections`: the 9 rooms sections (`origins`, `land`, `house`, `costume`, `festivals`, `music`,
  `food`, `family`, `today`). Leave a section out if there is not enough material yet.
- Each section is a list of `blocks`. Available types:
  `text`, `did` ("Bạn có biết?" box), `cards`, `steps`, `compare`, `phrases`, `list`, `badge`, `figure`.
- Text supports `**bold**` and `*italic*`; separate paragraphs with a blank line.
- `quiz`: the end-of-room questions (`answer` is the 0-based index of the correct option).
- `chat`: greeting and up to 4 suggested questions for the AI guide.
- `sources`: references shown at the bottom of the page.

The AI guide answers **only** from this file, so improving the content also improves the chat.

The closing page no longer lists team members. `src/data/team.ts` and
`src/components/MemberCard.astro` are kept (unused) in case the section is brought back.

## Images

- Placeholder watercolor illustrations: `src/assets/illustrations/` (`hero.jpg`, `ha-nhi.jpg`,
  `pa-then.jpg`, `ede.jpg`). Replace them with the final artwork using the same file names;
  Astro resizes and converts them to modern formats automatically.
- The map outline in `src/data/map.ts` is a simplified hand trace. It must always show the
  Hoàng Sa and Trường Sa archipelagos; ask the illustrator to redraw it for the final version.
- Documentary photos extracted from the team's Word research files live in
  `src/assets/photos/<group>/<nn>.jpg` (resized to max 1600 px). Reference them in the YAML as
  `photo: pa-then/15` and always add a `credit`. They appear as:
  - `heroPhoto` (room header, postcards, map cards),
  - `figure` blocks (one photo), `gallery` blocks (several photos, click to enlarge),
  - `photo` + `credit` on `cards` and `steps` items (thumbnail on the card).
- The closing page lists every photo credit automatically.
- These photos belong to the press outlets and museums credited under each image. They are used
  for a school project; ask for permission before publishing the site publicly.

## AI chat guide

- UI: `src/components/ChatGuide.astro` + `src/scripts/chat.ts`
- Server: `src/pages/api/chat.ts` (streams the answer from the chosen AI provider)
- Prompt and grounding rules: `src/lib/chat-context.ts`
- Two providers are supported. The server uses whichever key is set (Gemini first), or the
  one named in `AI_PROVIDER`:

  | Provider | Key | Model variable (default) | Cost |
  | -------- | --- | ------------------------ | ---- |
  | Google Gemini | `GEMINI_API_KEY` from <https://aistudio.google.com/apikey> | `GEMINI_MODEL` (`gemini-flash-lite-latest`, falls back to `gemini-flash-latest` when busy) | Free tier (rate limited; Google may use free-tier prompts to improve its products) |
  | Anthropic Claude | `ANTHROPIC_API_KEY` from <https://console.anthropic.com> | `AI_MODEL` (`claude-haiku-5-5`) | Paid per use; prompt caching keeps it cheap |

- Other variables: `AI_PROVIDER` (`gemini` or `claude`, optional), `CHAT_RATE_LIMIT`
  (questions per visitor per hour, default 20).
- Set the variables in `.env` locally and in the hosting dashboard. Redeploy after changing them.
- The built-in rate limiter is per server instance; use a shared store (e.g. Upstash Redis) if
  you need a strict global limit. For Claude, also set a monthly spend limit in the Console.
- Before launch, run the team's test questions (including tricky ones) against all three rooms.

## Deploying (Vercel)

1. Push this folder to a GitHub repository.
2. Import the repository at <https://vercel.com/new> (framework: Astro, detected automatically).
3. Add `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) under Project → Settings → Environment Variables.
4. Deploy. Every push to the main branch redeploys the site.

To use Netlify or Cloudflare Pages instead, replace the adapter in `astro.config.mjs`
(`@astrojs/netlify` or `@astrojs/cloudflare`). GitHub Pages cannot run the chat function.

## Project structure

```
src/
  assets/illustrations/   placeholder artwork (replace with final watercolors)
  components/             Header, Footer, VietnamMap, Postcard, Block, Quiz, ChatGuide, ...
  content/ethnic-groups/  one YAML file per ethnic group
  data/                   map geometry, illustrations registry, team
  layouts/BaseLayout.astro
  lib/                    helpers (groups, text formatting, chat prompt)
  pages/                  routes (see table above)
  scripts/                browser scripts: passport, quiz, chat
  styles/global.css       design tokens and shared styles
public/                   favicon, paper texture
design-mockups/           static HTML mockups used as the design reference
```
