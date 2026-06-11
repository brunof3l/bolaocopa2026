import { relations, sql } from "drizzle-orm";
import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const matchStatusEnum = pgEnum("match_status", ["SCHEDULED", "FINISHED"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  totalBalance: numeric("total_balance", {
    precision: 10,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(sql`0.00`),
});

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamA: text("team_a").notNull(),
  teamB: text("team_b").notNull(),
  group: text("group").notNull(),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  rolloverResult: numeric("rollover_result", {
    precision: 10,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(sql`0.00`),
  rolloverGoals: numeric("rollover_goals", {
    precision: 10,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(sql`0.00`),
  rolloverExact: numeric("rollover_exact", {
    precision: 10,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(sql`0.00`),
  scoreA: integer("score_a"),
  scoreB: integer("score_b"),
  status: matchStatusEnum("status").notNull().default("SCHEDULED"),
});

export const guesses = pgTable(
  "guesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    guessA: integer("guess_a").notNull(),
    guessB: integer("guess_b").notNull(),
    earnedBalance: numeric("earned_balance", {
      precision: 10,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(sql`0.00`),
  },
  (table) => ({
    guessPerUserMatchIdx: uniqueIndex("guesses_user_match_uidx").on(
      table.userId,
      table.matchId,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  guesses: many(guesses),
}));

export const matchesRelations = relations(matches, ({ many }) => ({
  guesses: many(guesses),
}));

export const guessesRelations = relations(guesses, ({ one }) => ({
  user: one(users, {
    fields: [guesses.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [guesses.matchId],
    references: [matches.id],
  }),
}));

export type DbUser = typeof users.$inferSelect;
export type NewDbUser = typeof users.$inferInsert;
export type DbMatch = typeof matches.$inferSelect;
export type NewDbMatch = typeof matches.$inferInsert;
export type DbGuess = typeof guesses.$inferSelect;
export type NewDbGuess = typeof guesses.$inferInsert;
