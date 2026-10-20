import { db } from "sdk";
import { eq, desc } from "sdk/db";

import {
  projects,
  users
} from "../schema.js";

import {
  ensureUser,
  isAdmin,
  statusLabel
} from "../lib/common.js";

const MAX_PROJECTS = 200;

export default async function (input, ctx) {
  const user = ctx.initData.user;

  if (!user) {
    throw new Error("Telegram user not available");
  }

  await ensureUser(user);

  const admin = isAdmin(user.id);

  let projectQuery = db
    .select()
    .from(projects);

  if (!admin) {
    projectQuery = projectQuery.where(
      eq(projects.clientId, Number(user.id))
    );
  }

  const rows = await projectQuery
    .orderBy(desc(projects.createdAt))
    .limit(MAX_PROJECTS)
    .all();

  // Admin sees who submitted each project.
  const clients = new Map();

  if (admin) {
    const allUsers = await db
      .select()
      .from(users)
      .all();

    for (const client of allUsers) {
      clients.set(Number(client.id), client);
    }
  }

  return {
    user: {
      id: user.id,
      firstName: user.first_name,
      username: user.username || null,
      role: admin ? "admin" : "client"
    },

    projects: rows.map(project => {
      const item = {
        ...project,
        statusLabel: statusLabel(project.status)
      };

      if (admin) {
        const client = clients.get(Number(project.clientId));

        item.clientName = client?.firstName || null;
        item.clientUsername = client?.username || null;
      }

      return item;
    })
  };
}
