import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  customType,
} from "drizzle-orm/pg-core";

/**
 * Postgres `bytea` column mapped to Node Buffer. The postgres.js driver
 * represents binary columns as Buffer by default.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer) {
    return value;
  },
  fromDriver(value: Buffer) {
    return Buffer.from(value);
  },
});

export const pastes = pgTable(
  "pastes",
  {
    code: varchar("code", { length: 12 }).primaryKey(),
    ciphertext: bytea("ciphertext").notNull(),
    iv: bytea("iv").notNull(),
    authTag: bytea("auth_tag").notNull(),
    keyWrapped: bytea("key_wrapped").notNull(),
    salt: bytea("salt"),
    kdfIterations: integer("kdf_iterations"),
    burnAfterRead: boolean("burn_after_read").default(false).notNull(),
    consumed: boolean("consumed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    views: integer("views").default(0).notNull(),
  },
  (table) => [
    index("pastes_expires_at_idx").on(table.expiresAt),
    index("pastes_created_at_idx").on(table.createdAt),
  ]
);

export type Paste = typeof pastes.$inferSelect;
export type NewPaste = typeof pastes.$inferInsert;
