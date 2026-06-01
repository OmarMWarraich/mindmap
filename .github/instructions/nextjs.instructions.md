---
description: "Use when writing or reviewing Next.js route handlers, React components, layouts, or metadata. Covers App Router patterns, client/server components, auth, and error handling for this project."
applyTo: "app/**/*.tsx", "app/**/*.ts", "components/**/*.tsx"
---

# Next.js & React Conventions

> This project uses **Next.js 16 with the App Router** and **React 19**. There is no `pages/` directory.
> Refer to the official Next.js App Router documentation at https://nextjs.org/docs for any API details you are unsure about.

## Route Handlers (`app/api/**/route.ts`)

- Always export `runtime = 'nodejs'` at the top.
- Wrap handlers with Auth.js's `auth()` helper; return 401 if `req.auth?.user?.id` is absent.
- Return `Response.json(...)` — not `NextResponse.json(...)`.
- Import `ZodError` from `zod`. Parse and validate the request body with `schema.parse(await req.json())` inside the `try` block so `ZodError` is caught automatically.
- Map errors to HTTP status codes consistently:
  - `400` — Zod `ZodError` (invalid request body)
  - `401` — unauthenticated
  - `429` — rate limit exceeded
  - `500` — unexpected / unknown errors

```typescript
export const runtime = "nodejs";

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // ...
    return Response.json(result);
  } catch (error) {
    if (!(error instanceof ZodError)) console.error(error);
    const status = error instanceof ZodError ? 400 : 500;
    const message =
      error instanceof ZodError ? error.message : "Internal server error";
    return Response.json({ error: message }, { status });
  }
});
```

## Client vs Server Components

- Add `'use client'` only to components that use browser APIs, hooks, or interactivity.
- API routes and layout files are server-side by default — do not add `'use client'` to them.

## Component Organization

- Shared UI components go in `components/` at the root.
- Feature-group subdirectories for cohesive sets: `components/marketing/`.
- Declare a `Props` interface at the top of the file, above the component.

## Metadata

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Title",
  description: "...",
};
```

## Fonts

- Load fonts via `next/font/google` in the root layout — do not load them in individual pages.

## Data Fetching

- Prefer `fetch` with `{ next: { revalidate: N } }` in Server Components for cached data.
- Use SWR or React Query only in Client Components when real-time or user-triggered updates are needed.
- Never call internal API routes from Server Components; import the service/logic directly instead.

## `next.config.ts`

- Export as `export default nextConfig` using the `NextConfig` type.
- Keep the config minimal; add options only when required.
