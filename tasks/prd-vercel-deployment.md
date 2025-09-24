## Vercel Deployment PRD

### 1. Introduction / Overview
Deploy the existing Next.js App Router application to Vercel using Serverless Functions for APIs, Vercel Postgres for the database, Vercel Blob for file uploads, and Sentry for monitoring. The goal is a reliable, EU-region production deployment with preview environments, GitHub CI/CD, environment variables managed in Vercel, and light protection (rate limiting + admin auth) on critical routes.

### 2. Goals
- Ensure production-ready deploys on Vercel with reproducible builds and working database/storage
- Migrate from local filesystem uploads to cloud storage (Vercel Blob)
- Configure Prisma to target Vercel Postgres and run `prisma migrate deploy` on each deploy
- Provide preview deployments for PRs with isolated environment variables
- Enforce basic security: rate limiting and admin route protection
- Set region to EU for lower latency to target users
- Integrate Sentry for error monitoring and tracing

### 3. User Stories
- As a developer, I can merge to `main` and Vercel deploys production automatically with successful health checks.
- As a reviewer, I can open a preview URL for each PR to validate features safely with the correct env vars.
- As an admin, I can upload recipe images and files; uploads persist and are accessible via signed URLs.
- As an operator, I can view errors and traces in Sentry to troubleshoot issues.
- As a user, I experience responsive performance with APIs running reliably in EU.

### 4. Functional Requirements
1. Deployment
   1.1 The app must deploy to Vercel from GitHub via the Vercel GitHub integration.
   1.2 The build must succeed in Vercel without interactive steps.
   1.3 Set framework preset to Next.js (App Router).

2. Runtime & Regions
   2.1 Use Vercel Serverless Functions for API routes by default.
   2.2 Set project region preference to EU.

3. Environment Variables
   3.1 Configure env vars in Vercel (Production, Preview, Development) based on the repository’s `.env.local`.
   3.2 The app must not rely on local defaults for production secrets.
   3.3 Support preview-specific values when necessary (e.g., database, blob buckets).

4. Database (Vercel Postgres) & Prisma
   4.1 Provision a Vercel Postgres database (Production + optional Preview DBs or shared with schema namespaces).
   4.2 Set Prisma `DATABASE_URL` to the Vercel Postgres connection string.
   4.3 On each deployment, run `prisma migrate deploy` (Vercel Build or Post-Install step) before serving traffic.
   4.4 Ensure Prisma Client is generated at build time and works in Serverless.
   4.5 Implement soft delete and existing middleware without breaking serverless.

5. File Uploads (Vercel Blob)
   5.1 Replace local `public/uploads/recipes/` writes with Vercel Blob uploads.
   5.2 Use signed URLs for client access; do not expose public write access.
   5.3 Ensure image processing/optimization is compatible with signed URLs and Next Image.

6. Media/AI Processing
   6.1 Offload heavy processing to external APIs (e.g., Whisper API) instead of local binaries.
   6.2 Set timeouts and request size limits appropriate to Serverless constraints.
   6.3 Disable or guard CPU-intensive local flows in production.

7. Images Configuration
   7.1 Configure `next.config.mjs` images to allow required external domains via `images.domains` or `remotePatterns`.
   7.2 Ensure no wildcard overexposure in production beyond what’s needed.

8. Scheduling
   8.1 Define required scheduled tasks and implement using Vercel Cron.
   8.2 Scheduled tasks must run via dedicated endpoints protected from public invocation.

9. Preview Environments
   9.1 Enable preview deployments per PR.
   9.2 Provide separate environment variables for Preview.
   9.3 Ensure database strategy for previews (separate DBs or schemas) is defined.

10. Domain & SSL
   10.1 Use default `vercel.app` domain initially.
   10.2 Document steps for adding a custom domain later.

11. Security & Protection
   11.1 Add rate limiting middleware for APIs.
   11.2 Protect admin routes with an environment-based key or proper auth.
   11.3 Sanitize user inputs for all API endpoints.

12. Monitoring & Observability
   12.1 Integrate Sentry for error and performance monitoring.
   12.2 Sentry DSN must be set for all environments where applicable.
   12.3 Ensure source maps are uploaded to Sentry during build.

13. Documentation
   13.1 Provide a deployment runbook (README section) describing env vars, common commands, and rollback steps.
   13.2 Document limitations vs local dev (e.g., no local FS persistence).

### 5. Non-Goals (Out of Scope)
- Edge runtime migration for all routes (only use Serverless by default)
- Implementing a full authentication system beyond admin protections
- Rewriting existing features not related to deployment
- Complex worker infrastructure; background jobs beyond Vercel Cron

### 6. Design Considerations (Optional)
- UI remains unchanged; ensure upload UI works with signed URLs and shows progress/errors gracefully.
- Accessibility and responsiveness remain as existing standards.

### 7. Technical Considerations (Optional)
- Next.js App Router with minimal `use client` usage; prefer RSC.
- Replace filesystem writes with Vercel Blob SDK. Avoid `fs` in runtime code.
- Prisma Client reuse pattern honored in serverless (`globalThis.prisma` already used in `src/lib/prisma.ts`).
- Increase body size only where required and safe; be mindful of Vercel Serverless limits.
- Rate limiting via middleware to prevent abuse of AI endpoints.

### 8. Environment Variables (Initial Inventory)
Configure in Vercel Project settings. Values below are examples/placeholders.

- `DATABASE_URL` (Vercel Postgres connection string)
- `OPENAI_API_KEY` (if used by media routes)
- `ANTHROPIC_API_KEY`
- `HF_API_KEY` (Hugging Face, for some routes)
- `LLM_PROVIDER` (e.g., `ollama`, `openai`, `anthropic`) – choose production provider
- `OLLAMA_HOST` (omit in prod if not using local Ollama)
- `VIDEO_TEMP_DIR` (remove or set to a temp path if still referenced)
- `VIDEO_PROCESSING_TIMEOUT` (tune for serverless, e.g., `60000`)
- `ENABLE_VIDEO_IMPORT` (`false` in production if heavy local processing is disabled)
- `NEXT_PUBLIC_ADMIN_KEY` (temporary admin gate for UI; consider stronger auth)
- `SENTRY_DSN` (for Sentry)

Note: Review all runtime references and eliminate localhost defaults in production builds.

### 9. Success Metrics
- 100% successful deploy from `main` with zero manual steps
- p95 API latency remains within acceptable thresholds in EU region
- 0 data loss incidents from uploads; signed URL access working
- Sentry shows application errors with source maps and useful stack traces
- Preview deployments available for 100% of PRs

### 10. Acceptance Criteria
1. A production Vercel project is live with the app accessible on a `vercel.app` domain.
2. Vercel Postgres is provisioned; Prisma connects and `prisma migrate deploy` runs during deploy without errors.
3. All file uploads use Vercel Blob with signed URLs; no writes to local filesystem in production.
4. Environment variables are set in Vercel for Production and Preview; app boots without missing-secret errors.
5. Rate limiting middleware is active; admin routes require configured key or auth.
6. Sentry is integrated; errors from production appear in Sentry with source maps.
7. Image configuration allows required remote domains only; Next Image renders assets successfully.
8. Vercel Cron is configured for any scheduled tasks (documented list) and runs successfully.
9. GitHub integration provides automatic deploys for `main` and preview deployments for PRs.

### 11. Open Questions
- Which provider should be the default in production for LLM operations (`LLM_PROVIDER`)?
- Do we need separate Vercel Postgres databases per environment (Production/Preview) or a single DB with schema separation?
- Exact set of remote image domains to allow in `next.config.mjs` for production (current wildcard may be too broad).
- Which scheduled tasks should be enabled via Vercel Cron (list and cadence)?
- Do we keep any video import features enabled in production, or toggle them off by default?

### 12. Implementation Notes (Checklist-Oriented)
- Vercel Project Setup
  - Connect GitHub repo, framework: Next.js
  - Region: EU
  - Env groups: Production, Preview, Development
- Database
  - Provision Vercel Postgres
  - Set `DATABASE_URL`; verify Prisma connection
  - Add deploy step: `prisma migrate deploy`
- Storage
  - Provision Vercel Blob; update code to use Blob SDK
  - Replace any `fs` writes/reads in upload flows
- Security
  - Add rate limiting middleware
  - Protect admin routes with env key or auth
- Monitoring
  - Add Sentry SDK, set `SENTRY_DSN`, upload source maps
- Images
  - Set `images.domains` / `remotePatterns` to specific domains
- Cron
  - Define tasks; add Vercel Cron config
- Docs
  - Update README with deploy runbook and env var table


