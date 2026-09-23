# Vercel deployment

## Project settings

Use Vercel's native Next.js deployment for this repository.

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Install command | `bun install --frozen-lockfile` |
| Build command | `bun run build` |
| Output directory | Default |
| Runtime | Node.js |
| Dockerfile | Not used by Vercel |

Vercel detects Next.js from the `next` dependency and manages the Next.js server and route functions. Do not add a Docker runtime for the Vercel project.

## Environment variables

Add production and preview values in Vercel Project Settings. Do not commit values or copy secrets into this document.

Required server values:

- `DATABASE_URL`
- `MIGRATION_DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `APP_URL`
- `ADMIN_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `RATE_LIMIT_SECRET`

Required public value:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

Optional mail values:

- `RESEND_ENABLED=false` until the owner activates delivery verification
- `RESEND_API_KEY`
- `RESEND_FROM`
- `OWNER_EMAIL`

Use a production origin for `APP_URL`, with no trailing path. Keep preview and production values scoped to the correct Vercel environment.

## First deployment

1. Create or select the Vercel project and connect the GitHub repository.
2. Add the environment variables above in the required Vercel scopes.
3. Run the approved database migration using `MIGRATION_DATABASE_URL` before exercising database-backed routes:

   ```bash
   bun run db:migrate
   ```

4. Set `APP_URL` to the production origin and add the matching Google OAuth origins and redirect URI.
5. Configure Cloudinary credentials and the public cloud name.
6. Keep Resend disabled until the sender domain, sender address, recipient, Reply-To policy, API key, and explicit owner activation are ready.
7. Create a preview deployment from the branch or pull request.
8. Run the browser, database, authentication, Cloudinary, and content gates against the approved environment.
9. Promote to production only after those checks produce evidence.

## Verification boundary

The repository's local test, lint, typecheck, and build commands prove code-level behavior only. A Vercel deployment URL, provider connection, OAuth login, database migration, and email delivery must not be reported as successful until each is observed in the target environment.
