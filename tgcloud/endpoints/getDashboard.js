import { db } from "sdk";
import { eq, desc } from "sdk/db";

import {
  users,
  projects,
  projectStatuses
} from "../schema.js";

import {
  ensureUser,
  isAdmin,
  statusLabel
} from "../lib/common.js";

export default async function (input, ctx) {
  const user = ctx.initData.user;

  if (!user) {
    throw new Error("Telegram user not available");
  }

  await ensureUser(user);

  let projectQuery = db
    .select()
    .from(projects);

  if (!isAdmin(user.id)) {
    projectQuery = projectQuery.where(
      eq(projects.clientId, Number(user.id))
    );
  }

  const rows = await projectQuery
    .orderBy(desc(projects.createdAt))
    .all();

  const statuses = await db
    .select()
    .from(projectStatuses)
    .where(eq(projectStatuses.active, 1))
    .all();

  return {
    user: {
      id: user.id,
      firstName: user.first_name,
      username: user.username || null,
      role: isAdmin(user.id) ? "admin" : "client"
    },

    projects: rows.map(project => ({
      ...project,
      statusLabel: statusLabel(project.status)
    })),

    statuses
  };
}