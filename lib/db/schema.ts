import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import type { Locale } from '@/lib/i18n/config'

/** Copy that exists in all three languages, keyed by URL segment. */
export type Localised = Record<Locale, string>

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: jsonb('title').$type<Localised>().notNull(),
    /** One line on what the work achieved. Not a description. */
    result: jsonb('result').$type<Localised>().notNull(),
    role: jsonb('role').$type<Localised>().notNull(),
    year: integer('year').notNull(),
    stack: text('stack').array().notNull().default(sql`ARRAY[]::text[]`),
    liveUrl: text('live_url'),
    repoUrl: text('repo_url'),
    /** Ordering in the work gallery. Lower sorts first. */
    position: integer('position').notNull().default(0),
    /** Unpublished rows stay out of every public query. */
    published: boolean('published').notNull().default(false),
    /**
     * True while the row is authored placeholder material rather than real
     * client work. The interface must never present a synthetic row as fact.
     */
    synthetic: boolean('synthetic').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('projects_published_position_idx').on(table.published, table.position)],
)

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    message: text('message').notNull(),
    locale: text('locale').notNull(),
    /** Salted hash. The raw address is never stored. */
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    /** Null until Resend accepts the notification. */
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('submissions_created_at_idx').on(table.createdAt)],
)

export const sectionViews = pgTable(
  'section_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    section: text('section').notNull(),
    locale: text('locale').notNull(),
    /** Per-day salted hash. Not a durable identifier, not a cookie. */
    visitorHash: text('visitor_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('section_views_section_idx').on(table.section, table.createdAt)],
)

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Submission = typeof submissions.$inferSelect
