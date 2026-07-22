import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const uniformPurchasesTable = pgTable("uniform_purchases", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  uniformId: text("uniform_id").notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  fulfilled: boolean("fulfilled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUniformPurchaseSchema = createInsertSchema(uniformPurchasesTable).omit({
  createdAt: true,
});
export type InsertUniformPurchase = z.infer<typeof insertUniformPurchaseSchema>;
export type UniformPurchase = typeof uniformPurchasesTable.$inferSelect;
