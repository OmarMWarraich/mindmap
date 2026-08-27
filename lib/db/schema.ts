import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/core/adapters';

// ---------------------------------------------------------------------------
// Auth.js required tables
// ---------------------------------------------------------------------------

export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

export const projects = pgTable('project', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Untitled Project'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

export const projectDrafts = pgTable('project_draft', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  outline: text('outline').notNull().default(''),
  rawNotes: text('rawNotes').notNull().default(''),
  selectedDetailLevel: text('selectedDetailLevel').notNull().default('standard'),
  mindmap: jsonb('mindmap'),
  previewTransform: jsonb('previewTransform'),
  nodePositionOverrides: jsonb('nodePositionOverrides'),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

export const generationHistory = pgTable('generation_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  detailLevel: text('detailLevel').notNull(),
  dsl: text('dsl').notNull(),
  densityStatus: text('densityStatus').notNull(),
  nodeCount: integer('nodeCount').notNull(),
  rawNotes: text('rawNotes').notNull().default(''),
}, (history) => ({
  projectCreatedAtIdx: index('generation_history_projectId_createdAt_idx').on(history.projectId, history.createdAt),
}));

// Inline-completion telemetry. Privacy: the raw suggestion text is never stored — only
// its length — since it can echo the user's notes. Indexed for the acceptance-rate
// query path (by user over time, and by outcome).
export const completionEvents = pgTable('completion_event', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  correlationId: text('correlationId').notNull(),
  outcome: text('outcome').notNull(),
  source: text('source').notNull(),
  requestReason: text('requestReason').notNull(),
  outlineLength: integer('outlineLength').notNull(),
  suggestionLength: integer('suggestionLength').notNull(),
  shownDurationMs: integer('shownDurationMs').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (event) => ({
  userCreatedAtIdx: index('completion_event_userId_createdAt_idx').on(event.userId, event.createdAt),
  outcomeIdx: index('completion_event_outcome_idx').on(event.outcome),
}));

// TypeScript types inferred from schema
export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectDraft = typeof projectDrafts.$inferSelect;
export type GenerationHistoryEntry = typeof generationHistory.$inferSelect;
export type CompletionEvent = typeof completionEvents.$inferSelect;
