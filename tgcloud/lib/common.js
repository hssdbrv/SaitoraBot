import { api, db } from "sdk";
import { eq } from "sdk/db";

import {
  users,
  projects,
  projectActivity
} from "../schema.js";

/*
 * Replace this value with your own Telegram numeric user ID.
 */
export const ADMIN_ID = 6467909267;

/*
 * Set this ONCE, after `npm run deploy` prints the Mini App URL
 * (e.g. https://app12345.tgcloud.ai/). Used by all handlers.
 */
export const MINI_APP_URL = "https://app8836683855.tgcloud.ai/";

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

export async function ensureUser(user, source = "mini_app") {
  const userId = Number(user.id);
  const role = isAdmin(userId) ? "admin" : "client";

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (existing) {
    await db
      .update(users)
      .set({
        firstName: user.first_name || existing.firstName,
        username: user.username || null,
        role
      })
      .where(eq(users.id, userId))
      .run();

    return {
      ...existing,
      firstName: user.first_name || existing.firstName,
      username: user.username || null,
      role
    };
  }

  const firstName = user.first_name || "کاربر";

  try {
    await db
      .insert(users)
      .values({
        id: userId,
        firstName,
        username: user.username || null,
        role
      })
      .run();
  } catch (error) {
    // Another request created this user a moment ago.
    const created = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (created) return created;
    throw error;
  }

  if (role !== "admin") {
    await notifyNewUser(user, source);
  }

  return {
    id: userId,
    firstName,
    username: user.username || null,
    role
  };
}

async function notifyNewUser(user, source) {
  try {
    const total = await db.$count(users);

    let time;
    try {
      time = new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Tehran"
      });
    } catch {
      time = new Date().toISOString();
    }

    const fullName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ");

    await notifyAdmin(
      "🆕 <b>کاربر جدید در سایتورا</b>\n\n" +
      `👤 نام: ${escapeHtml(fullName || "نامشخص")}\n` +
      `🆔 شناسه: <code>${Number(user.id)}</code>\n` +
      `🔗 نام کاربری: ${user.username ? "@" + escapeHtml(user.username) : "ندارد"}\n` +
      `🌐 زبان: ${escapeHtml(user.language_code || "نامشخص")}\n` +
      `⭐ پریمیوم: ${user.is_premium ? "بله" : "خیر"}\n` +
      `📲 ورود از: ${source === "bot" ? "ربات" : "برنامه سایتورا"}\n` +
      `👥 تعداد کل کاربران: ${total}\n` +
      `🕒 زمان: ${escapeHtml(time)}\n\n` +
      `<a href="tg://user?id=${Number(user.id)}">باز کردن پروفایل</a>`
    );
  } catch (error) {
    console.error("notifyNewUser failed:", error?.description || error);
  }
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
  try {
    await api.sendMessage({
      chat_id: ADMIN_ID,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup
    });
  } catch (error) {
    console.error("notifyAdmin failed:", error?.description || error);
  }
}

/*
 * Never throws: a client who blocked the bot must not break
 * an already-saved status change.
 * `text` is sent as HTML — callers must escapeHtml() any user data.
 */
export async function notifyClient(project, text) {
  try {
    await api.sendMessage({
      chat_id: project.clientId,
      text,
      parse_mode: "HTML"
    });
  } catch (error) {
    console.error("notifyClient failed:", error?.description || error);
  }
}

export async function getProjectById(id) {
  return await db
    .select()
    .from(projects)
    .where(eq(projects.id, Number(id)))
    .get();
}

/*
 * Single source of truth for accepting / declining a pending project.
 * Used by both the Mini App endpoint and the bot's inline buttons.
 *
 * decision: "accepted" | "declined"
 * Throws Error with a Persian `message` and `.code` on invalid state.
 */
export async function reviewProjectDecision(projectId, decision, actorId) {
  if (!["accepted", "declined"].includes(decision)) {
    throw Object.assign(new Error("تصمیم انتخاب‌شده معتبر نیست."), {
      code: "BAD_DECISION"
    });
  }

  const project = await getProjectById(projectId);

  if (!project) {
    throw Object.assign(new Error("پروژه پیدا نشد."), {
      code: "NOT_FOUND"
    });
  }

  if (project.status !== "pending") {
    throw Object.assign(new Error("این پروژه قبلاً بررسی شده است."), {
      code: "ALREADY_REVIEWED"
    });
  }

  // Only update if it is STILL pending (guards against double-clicks).
  const updated = await db
    .update(projects)
    .set({
      status: decision,
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(
      eq(projects.id, project.id),
      eq(projects.status, "pending")
    )
    .returning({ id: projects.id })
    .run();

  if (Array.isArray(updated) && updated.length === 0) {
    throw Object.assign(new Error("این پروژه قبلاً بررسی شده است."), {
      code: "ALREADY_REVIEWED"
    });
  }

  await recordActivity(
    project.id,
    Number(actorId),
    decision,
    "بررسی درخواست توسط مدیر"
  );

  const title = escapeHtml(project.title);

  await notifyClient(
    project,
    decision === "accepted"
      ? `خبر خوب! پروژه «${title}» پذیرفته شد.\n\nوضعیت فعلی: ${statusLabel(decision)}`
      : `درخواست پروژه «${title}» بررسی شد و در حال حاضر پذیرفته نشد.\n\nبرای اطلاعات بیشتر می‌توانید با فریلنسر تماس بگیرید.`
  );

  return {
    project: { ...project, status: decision },
    status: decision,
    statusLabel: statusLabel(decision)
  };
}