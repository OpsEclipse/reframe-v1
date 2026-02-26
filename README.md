# VEAP (Next.js + Vercel-ready)

This project is migrated from a Vite React prototype to a Next.js App Router app so it can be deployed on Vercel with serverless API routes.

## Tech stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS v4

## Local development

1. Install dependencies:
   - `npm install`
2. Start the dev server:
   - `npm run dev`
3. Open:
   - `http://localhost:3000`

## Build and run

1. Create a production build:
   - `npm run build`
2. Run the production server:
   - `npm run start`

## API scaffold

- `GET /api/health` returns a basic health payload.
- `GET /api/veap` returns `501 Not Implemented`.
- `POST /api/veap` returns `501 Not Implemented`.
- `POST /api/ingestion/presign` returns pre-signed S3 upload URLs for journal files.
- `POST /api/ingestion/submit` writes manifest state and asynchronously invokes the Starter Lambda.
- `GET /api/ingestion/[ingestionId]/status` returns manifest-backed ingestion progress.
- `GET /api/ingestion/[ingestionId]/results` returns extracted journal entries when terminal.

Required env vars for ingestion:

- `AWS_REGION`
- `AWS_INGESTION_BUCKET`
- `AWS_STARTER_LAMBDA_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (optional for temporary credentials)

## Vercel deployment

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Use default Next.js settings.
4. Add environment variables later as backend features are implemented.
  
