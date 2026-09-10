import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const n8nConnections = sqliteTable('n8n_connections', {
  userId: text('user_id').primaryKey(),
  instanceUrl: text('instance_url').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  connectedAt: text('connected_at').notNull(),
});
