import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { key: text('key').primaryKey(), value: text('value').notNull() });
export const checks = sqliteTable('checks', { id: text('id').primaryKey(), siteId: text('site_id').notNull(), at: integer('at').notNull(), value: text('value').notNull() },(t)=>[index('checks_site_at').on(t.siteId,t.at)]);
export const incidents = sqliteTable('incidents', { id: text('id').primaryKey(), key: text('key').notNull(), opened: integer('opened').notNull(), seen: integer('seen').notNull(), resolved: integer('resolved'), level: text('level').notNull(), title: text('title').notNull(), detail: text('detail').notNull(), read: integer('read').notNull().default(0), muted: integer('muted').notNull().default(0) },(t)=>[uniqueIndex('incidents_active_key').on(t.key).where(sql`${t.resolved} IS NULL`)]);
export const leases = sqliteTable('leases', { key: text('key').primaryKey(), until: integer('until').notNull(), owner: text('owner').notNull() });
