# Lena Mukosey portfolio

Bilingual Eleventy portfolio for `https://lena.mukosey.de`, with Sveltia CMS at `/admin/`.
Artwork and personal content are all rights reserved; website code is MIT-licensed. See [LICENSE](LICENSE).

## Development

Use Node.js 24:

```sh
npm ci
npm run dev    # http://localhost:8080
npm run build # output: public/
npm test      # build and CMS integration checks
```

For local CMS editing, open `/admin/index.html` in Chrome/Edge, choose **Work with Local Repository**, and select the repository root. No authentication is needed; saves modify local files.

Builds generate responsive AVIF (quality 65, effort 4) and JPEG fallback images. Derivatives are cached in `.cache/images/`, separately from `public/`; only images used by the current build are published. Source bytes, image settings and dependency versions determine reuse. Deleting the cache is safe, but makes the next build slower.

## Content and images

The CMS manages artworks in `src/works/`, biographies/contact links in `src/{ru,en}/info.md`, and gallery/work page titles. Artworks contain both languages; biographies are edited separately. Descriptions are plain text, not Markdown.

Images live in `src/assets/images/`; frontmatter stores filenames, not public URLs. New JPEG, PNG, WebP, AVIF and HEIC uploads are optimized to WebP at quality 90, max 3291 × 3291 px. The 15 MiB limit applies **after processing**. Keep archival originals separately: conversion is lossy and strips metadata. TIFF upload conversion is not supported; do not upload raw TIFFs through the generic Asset Library.

## Cloudflare Pages

Use the existing Git-integrated **Pages** project with native Cloudflare builds:

- Framework preset: **Eleventy**; production branch: `master`; root directory: repository root (blank).
- Build command: `npm test`; output directory: `public`; Node.js: `24` (specified in `.node-version`).
- Build system: **Version 3**; **build cache enabled**; automatic production deployments **enabled**.

Keep dependency installation enabled, including dev dependencies, and do not set `dev` in the build environment. Keep `lena.mukosey.de` under the project's custom domains. No GitHub Actions workflow, Wrangler, or deployment API token is needed.

Pages caches Eleventy's `.cache/` directory, including our generated images. The first build populates the cache; check a second build's logs to confirm restoration. Cache storage is limited to 10 GB per project and entries expire after seven days without access. A cache miss is safe but regenerates the images and can take several minutes. Cloudflare's CDN cache is separate and serves the finished files to visitors.

CMS saves commit directly to `master` and trigger Pages deployment. Editors need write access, and branch rules must permit these commits. Changes become public after a successful build and test run.

## GitHub sign-in

Token login is enabled until OAuth is configured. For the artist's normal sign-in:

1. Deploy the official [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) to Cloudflare Workers.
2. [Register a GitHub OAuth app](https://github.com/settings/applications/new) with homepage `https://lena.mukosey.de` and callback `<WORKER_URL>/callback`.
3. Set the Worker's `GITHUB_CLIENT_ID`, encrypted `GITHUB_CLIENT_SECRET`, and `ALLOWED_DOMAINS=lena.mukosey.de`. Add the actual Pages hostname only if login should also work there. Never commit secrets.
4. In `src/admin/config.yml`, set `backend.base_url` to the Worker URL and change `auth_methods` to `[oauth]`. Commit and redeploy.
5. Give the artist's own GitHub account write access, then test sign-in and a small edit at `/admin/`.
