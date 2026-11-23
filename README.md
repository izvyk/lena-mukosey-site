# Lena Mukosey portfolio

Bilingual Eleventy portfolio served on `lena.mukosey.com` and `lena.mukosey.ru`, with Sveltia CMS at `/admin/`. Canonical, link preview and sitemap URLs use the single address in `src/_data/site.json`; `lena.mukosey.de` is a private Cloudflare Workers test deployment behind Cloudflare Access.

Each artwork has its own page at `/works/<slug>/` and `/en/works/<slug>/`, used by search results and shared links. The slug comes from the English title, so renaming a work changes its URL.

## Development

Use Node.js 24.

```sh
npm ci
npm run dev   # http://localhost:8080
npm run build # output: public/
npm test      # build and integration checks
```

## Content

Edit through `/admin/` using a GitHub token, or choose **Work with Local Repository** in Chrome/Edge for local editing.

- Artworks: `src/works/` (both languages in each file).
- Biographies and contacts: `src/{ru,en}/info.md`.
- Page titles: `src/{ru,en}/{index,works}.md`.
- Images: `src/assets/images/`; frontmatter stores filenames.

CMS uploads are optimized to WebP; keep archival originals separately. TIFF uploads are unsupported. Site builds generate AVIF (quality 65) with JPEG fallback.

## Deployment

Workers Builds deploys pushes to `master`: build command `npm test`, deploy command `npx wrangler deploy`. `wrangler.jsonc` serves `public/` as static assets on `lena.mukosey.de` only (no `workers.dev` or preview URLs). Keep build cache enabled to reuse `.cache/images/`; cold builds can take several minutes. Generated images stay out of Git.

## License

Artwork and personal content are all rights reserved; website code is MIT-licensed. See [LICENSE](LICENSE).
