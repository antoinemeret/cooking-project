## Relevant Files

- `next.config.mjs` - Next config for images, body size, and headers.
- `src/lib/prisma.ts` - Prisma client instantiation in serverless.
- `prisma/schema.prisma` - Database schema; must align with Vercel Postgres.
- `src/app/api/**/route.ts` - API routes subject to rate limiting/security.
- `src/app/api/recipes/import-photo/route.ts` - Uses Anthropic API; serverless constraints.
- `src/app/api/recipes/import-video/route.ts` - Heavy processing; ensure external APIs/limits.
- `src/lib/ai-client.ts` - LLM provider and API keys usage.
- `src/lib/ai-video-client.ts` - Ollama/hosted model config; adjust for prod.
- `src/lib/speech-transcriber.ts` - Uses Ollama; production provider switch.
- `src/lib/performance-monitoring.ts` - Logging levels.
- `src/lib/analytics.ts` - Env-based analytics toggles.
- `README.md` - Deployment runbook section to be added/updated.
- `src/middleware.ts` (to be created) - Rate limiting and admin protection.
- `src/lib/blob.ts` (to be created) - Vercel Blob client helpers and signed URLs.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Vercel project, environments, and CI/CD setup (EU region, previews)
  - [x] 1.1 Create Vercel project, connect GitHub repo, select Next.js preset
  - [x] 1.2 Set default region to EU; enable preview deployments per PR
  - [x] 1.3 Configure environment groups (Production, Preview, Development)
  - [x] 1.4 Populate env vars from PRD inventory for each environment
  - [x] 1.5 Verify build succeeds with no interactive steps

- [ ] 2.0 Database on Vercel Postgres with Prisma migrate deploy
  - [ ] 2.1 Provision Vercel Postgres (prod and preview strategy)
  - [ ] 2.2 Set `DATABASE_URL` in Vercel; update `.env.example`
  - [ ] 2.3 Add deploy step to run `prisma migrate deploy`
  - [ ] 2.4 Validate Prisma Client generation and cold start behavior
  - [ ] 2.5 Smoke-test DB connectivity via a simple API route

- [ ] 3.0 File uploads via Vercel Blob and Next Image configuration
  - [ ] 3.1 Provision Vercel Blob and set required env vars
  - [ ] 3.2 Create `src/lib/blob.ts` for upload/signed URL helpers
  - [ ] 3.3 Refactor upload flows to use Blob instead of local FS
  - [ ] 3.4 Restrict `next.config.mjs` image domains/remotePatterns to known hosts
  - [ ] 3.5 Verify Next Image renders Blob-hosted assets

- [ ] 4.0 Media/AI processing via external APIs with serverless-safe limits
  - [ ] 4.1 Set production `LLM_PROVIDER` and keys (OpenAI/Anthropic/HF)
  - [ ] 4.2 Remove/disable local `ollama` and heavy binaries in prod
  - [ ] 4.3 Enforce request size/time limits on relevant API routes
  - [ ] 4.4 Add graceful error handling for third-party API timeouts
  - [ ] 4.5 Document which features are limited/disabled in production

- [ ] 5.0 Security hardening: rate limiting and admin route protection
  - [ ] 5.1 Implement `src/middleware.ts` with rate limiting for API routes
  - [ ] 5.2 Add admin protection using `NEXT_PUBLIC_ADMIN_KEY` or server-side key
  - [ ] 5.3 Sanitize and validate inputs on critical endpoints
  - [ ] 5.4 Add tests for middleware and protected routes

- [ ] 6.0 Observability, scheduling, and docs (Sentry, Vercel Cron, runbook)
  - [ ] 6.1 Integrate Sentry SDK and set `SENTRY_DSN`
  - [ ] 6.2 Upload source maps during build (Vercel/Sentry configuration)
  - [ ] 6.3 Define and configure Vercel Cron jobs and handlers
  - [ ] 6.4 Add deployment runbook to `README.md` (envs, rollback, limitations)
  - [ ] 6.5 Add monitoring and on-call notes for production


