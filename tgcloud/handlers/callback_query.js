import { api, db } from "sdk";
import { eq } from "sdk/db";

import {
  projects
} from "../schema.js";

import {
  ADMIN_ID,
  isAdmin,
  statusLabel,
  recordActivity,
  notifyClient,
  getProjectById
} from "../lib/common.js";

const MINI_APP_URL = "https://YOUR_APP_URL";

export default async function (query) {
  if (!query || !query.from || !query.data) {
    return;
  }

  const userId = Number(query.from.id);
  const data = query.data;

  if (data === "help") {
    await api.answerCallbackQuery({
      callback_query_id: query.id
    });

    await api.sendMessage({
      chat_id: query.message.chat.id,
      text:
        "برای ثبت پروژه، برنامه سایتورا را باز کنید.\n\n" +
        "پس از ثبت درخواست، وضعیت آن از طریق ربات اطلاع‌رسانی خواهد شد."
    });

    return;
  }

  if (data.startsWith("review:")) {
    if (!isAdmin(userId)) {
      await api.answerCallbackQuery({
        callback_query_id: query.id,
        text: "دسترسی غیرمجاز",
        show_alert: true
      });

      return;
    }

    const [, action, idString] = data.split(":");
    const projectId = Number(idString);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      await api.answerCallbackQuery({
        callback_query_id: query.id,
        text: "شناسه پروژه نامعتبر است.",
        show_alert: true
      });

      return;
    }

    const project = await getProjectById(projectId);

    if (!project) {
      await api.answerCallbackQuery({
        callback_query_id: query.id,
        text: "پروژه پیدا نشد.",
        show_alert: true
      });

      return;
    }

    if (project.status !== "pending") {
      await api.answerCallbackQuery({
        callback_query_id: query.id,
        text: "این پروژه قبلاً بررسی شده است.",
        show_alert: true
      });

      return;
    }

    if (action !== "accept" && action !== "decline") {
      await api.answerCallbackQuery({
        callback_query_id: query.id,
        text: "عملیات نامعتبر است.",
        show_alert: true
      });

      return;
    }

    const newStatus =
      action === "accept" ? "accepted" : "declined";

    await db
      .update(projects)
      .set({
        status: newStatus,
        updatedAt: Math.floor(Date.now() / 1000)
      })
      .where(eq(projects.id, projectId))
      .run();

    await recordActivity(
      projectId,
      userId,
      newStatus,
      "تصمیم مدیر"
    );

    await api.answerCallbackQuery({
      callback_query_id: query.id,
      text: action === "accept"
        ? "پروژه پذیرفته شد."
        : "پروژه رد شد."
    });

    await api.editMessageReplyMarkup({
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📂 مشاهده پروژه در سایتورا",
              web_app: {
                url: MINI_APP_URL
              }
            }
          ]
        ]
      }
    });

    const updatedProject = {
      ...project,
      status: newStatus
    };

    await notifyClient(
      updatedProject,
      action === "accept"
        ? `خبر خوب! پروژه «${project.title}» پذیرفته شد.\n\nوضعیت فعلی: ${statusLabel(newStatus)}`
        : `درخواست پروژه «${project.title}» بررسی شد و در حال حاضر پذیرفته نشد.\n\nبرای اطلاعات بیشتر می‌توانید با فریلنسر تماس بگیرید.`
    );

    await api.sendMessage({
      chat_id: ADMIN_ID,
      text:
        `پروژه شماره ${projectId} بررسی شد.\n` +
        `وضعیت جدید: ${statusLabel(newStatus)}`
    });

    return;
  }

  await api.answerCallbackQuery({
    callback_query_id: query.id
  });
}