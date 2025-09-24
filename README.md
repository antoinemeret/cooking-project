This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production Runbook (Vercel)

- Database: Prisma Vercel Integration (Neon + Accelerate)
  - Env: `DATABASE_URL`, `PRISMA_ACCELERATE_URL`
  - Migrations: `prisma migrate deploy` runs in `npm run build`

- File Storage: Vercel Blob
  - Env: `BLOB_READ_WRITE_TOKEN`
  - Upload helper: `src/lib/blob.ts`

- AI Providers
  - Provider: Anthropic (`LLM_PROVIDER=anthropic`)
  - Env: `ANTHROPIC_API_KEY`
  - Scraper fallback (production): uses HuggingFace if needed (`HUGGINGFACE_API_KEY` optional)

- Image Domains
  - `next.config.mjs` restricts to Vercel Blob hosts and `raw.githubusercontent.com`

- API Limits and Timeouts
  - Scrape: timeout guard via `SCRAPE_TIMEOUT_MS` (default 15s)
  - Import Photo: 5MB file size cap, 20s Anthropic timeout
  - Graceful timeouts return user-friendly errors with retry hints

- Known Production Limitations
  - Local `ollama` is disabled in production
  - Heavy/long-running processing should be moved to background jobs or external services
  - Some third-party sites may block scraping; fallback paths provide limited functionality

### Vercel Cron

- Handler: `GET /api/cron/daily`
- Suggested schedules:
  - Daily at 03:00 UTC: Health check/cleanup
- Vercel setup: Project → Settings → Cron Jobs → Add Job

### Rollback Procedure

- Use Vercel deployments list to promote a previous successful deployment
- Re-run `prisma migrate deploy` is safe (idempotent) on rollback
- Verify critical endpoints: `/api/db-ping`, `/api/scrape`, `/api/recipes/upload-image`

### Environment Variables (summary)

- Core: `NEXT_PUBLIC_APP_URL`, `NODE_ENV`
- Prisma: `DATABASE_URL`, `PRISMA_ACCELERATE_URL`
- Storage: `BLOB_READ_WRITE_TOKEN`
- AI: `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optional `HUGGINGFACE_API_KEY`
- Sentry: `SENTRY_DSN`
- Admin: `NEXT_PUBLIC_ADMIN_KEY` (or `ADMIN_KEY`)

### Monitoring and On-call

- Sentry alerts configured per project (set in Sentry UI)
- Recommended monitors:
  - Error rate spikes (server and client)
  - Latency on `/api/scrape`, `/api/recipes/import-photo`, `/api/recipes/import-video`
  - Cron endpoint failures `/api/cron/daily`
- Runbook on alert:
  1) Check Sentry event and recent deploy
  2) Verify env variables in Vercel
  3) Hit `/api/db-ping` for DB status
  4) Rollback deployment if needed
