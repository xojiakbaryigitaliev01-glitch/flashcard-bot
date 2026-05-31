import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userCardsTable = pgTable("user_cards", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  cards: jsonb("cards").notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserCardsSchema = createInsertSchema(userCardsTable).omit({ id: true, updatedAt: true });
export type InsertUserCards = z.infer<typeof insertUserCardsSchema>;
export type UserCards = typeof userCardsTable.$inferSelect;
