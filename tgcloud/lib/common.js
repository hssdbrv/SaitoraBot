import { api, db } from "sdk";
import { eq } from "sdk/db";

import {
  users,
  projects,
  projectActivity
} from "../schema.js";

/*
 * Replace this value with your own Telegram numeric user ID.
 *
 * You can obtain it using a trusted Telegram ID bot.
 * Do not use your username here.
 */
export const ADMIN_ID = 6467909267;

export function isAdmin(userId) {
  return Number(userId) === Number(ADMIN_ID);
}

export function statusLabel(status) {
  const labels = {
    pending: "در انتظار بررسی",
    accepted: "پذیرفته‌شده",
    developing: "در حال توسعه",
    testing: "در حال تست",
    finalizing: "در حال نهایی‌سازی",
    waiting_client: "در انتظار پاسخ کارفرما",
    completed: "تکمیل‌شده",
    on_hold: "متوقف‌شده",
    declined: "ردشده",
    cancelled: "لغوشده"
  };

  return labels[status] || status;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

export async function ensureUser(user) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(user.id)))
    .get();

  const role = isAdmin(user.id) ? "admin" : "client";

  if (existing) {
    await db
      .update(users)
      .set({
        firstName: user.first_name || existing.firstName,
        username: user.username || null,
        role
      })
      .where(eq(users.id, Number(user.id)))
      .run();

    return {
      ...existing,
      firstName: user.first_name || existing.firstName,
      username: user.username || null,
      role
    };
  }

  await db
    .insert(users)
    .values({
      id: Number(user.id),
      firstName: user.first_name || "کاربر",
      username: user.username || null,
      role
    })
    .run();

  return {
    id: Number(user.id),
    firstName: user.first_name || "کاربر",
    username: user.username || null,
    role
  };
}

export async function recordActivity(
  projectId,
  actorId,
  action,
  details = ""
) {
  await db
    .insert(projectActivity)
    .values({
      projectId: Number(projectId),
      actorId: Number(actorId),
      action,
      details
    })
    .run();
}

export async function notifyAdmin(text, replyMarkup) {
  if (!ADMIN_ID || ADMIN_ID === 123456789) {
    console.error(
      "Configure ADMIN_ID in tgcloud/lib/common.js"
    );
    return;
  }

  await api.sendMessage({
    chat_id: ADMIN_ID,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup
  });
}

export async function notifyClient(project, text) {
  await api.sendMessage({
    chat_id: project.clientId,
    text,
    parse_mode: "HTML"
  });
}

export async function getProjectById(id) {
  return await db
    .select()
    .from(projects)
    .where(eq(projects.id, Number(id)))
    .get();
}