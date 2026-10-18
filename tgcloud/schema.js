import {
  table,
  integer,
  text,
  sql
} from "sdk/db";

export const users = table("users", {
  id: integer("id").primaryKey(),

  firstName: text("first_name").notNull(),

  username: text("username"),

  role: text("role").notNull().default("client"),

  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`)
});

export const projects = table("projects", {
  id: integer("id").primaryKey({
    autoIncrement: true
  }),

  clientId: integer("client_id").notNull(),

  title: text("title").notNull(),

  description: text("description").notNull(),

  category: text("category").notNull(),

  budget: text("budget"),

  deadline: text("deadline"),

  status: text("status").notNull().default("pending"),

  adminNote: text("admin_note"),

  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),

  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`)
});

export const projectStatuses = table("project_statuses", {
  id: integer("id").primaryKey({
    autoIncrement: true
  }),

  name: text("name").notNull(),

  label: text("label").notNull(),

  position: integer("position").notNull().default(0),

  active: integer("active").notNull().default(1)
});

export const projectActivity = table("project_activity", {
  id: integer("id").primaryKey({
    autoIncrement: true
  }),

  projectId: integer("project_id").notNull(),

  actorId: integer("actor_id").notNull(),

  action: text("action").notNull(),

  details: text("details"),

  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`)
});