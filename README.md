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

The backend is intentionally minimal for now:

- `GET /api/health` returns a basic health payload.
- `GET /api/veap` returns `501 Not Implemented`.
- `POST /api/veap` returns `501 Not Implemented`.

## Vercel deployment

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Use default Next.js settings.
4. Add environment variables later as backend features are implemented.
  
