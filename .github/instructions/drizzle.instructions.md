---
description: "Use when writing or reviewing database schema, queries, migrations, or Drizzle ORM configuration. Covers Neon setup, pgTable conventions, type inference, and Drizzle Kit migrations."
applyTo: "lib/db/**/*.ts", "drizzle.config.ts"
---

# Drizzle ORM Patterns

## Client Setup

- Use the **Neon serverless HTTP client** (`@neondatabase/serverless` + `drizzle-orm/neon-http`).
- Export a single `db` instance from `lib/db/index.ts` with the full schema object attached.

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle({ client: sql, schema });
```

## Schema Definitions (`lib/db/schema.ts`)

- Use `pgTable()` with Drizzle column builders — never write raw `CREATE TABLE` SQL in application code.
- Primary keys:
  - Single-column: `.primaryKey()` on the column.
  - Composite: `primaryKey({ columns: [col1, col2] })` in the table's third argument.
- IDs: generate via `$defaultFn(() => crypto.randomUUID())` — do not use `serial`.
- Foreign keys: chain `.references(() => table.col, { onDelete: 'cascade' })` on the column.
- Timestamps: use `timestamp('col', { mode: 'date' }).notNull().defaultNow()`.
- For `updatedAt` columns, also chain `.$onUpdateFn(() => new Date())` so Drizzle sets the value automatically on every update.
- JSON data: use `jsonb('col')` for nested objects (e.g. mindmap data, transform state).
- Indexes: define inline in the table's third argument using `index('name_idx').on(col)`.

```typescript
export const projects = pgTable("project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Project"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});
```

## Relations

- After defining a table with foreign keys, export a `relations()` declaration so the relational query API can resolve joins.

```typescript
import { relations } from "drizzle-orm";

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
}));
```

## Query Style

- Prefer the relational query API (`db.query.table.findMany` / `db.query.table.findFirst`) for reads that follow declared relations.
- Use the builder API (`db.select().from()`) only when you need explicit column selection, aggregations, or queries that cannot be expressed through the relational API.

## Type Inference

- Always export inferred select types; do not hand-write duplicate interfaces.

```typescript
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

## Migrations

- Schema source of truth: `lib/db/schema.ts`.
- Migration output directory: `drizzle/`.
- Generate migrations with Drizzle Kit: `drizzle-kit generate`.
- Do **not** edit generated SQL files manually after the fact.
- `drizzle.config.ts` must always set `dialect: 'postgresql'` and read `DATABASE_URL` from the environment.
