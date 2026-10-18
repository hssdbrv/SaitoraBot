import { api } from "sdk";

import {
  ADMIN_ID,
  MINI_APP_URL,
  isAdmin,
  statusLabel,
  reviewProjectDecision
} from "../lib/common.js";

async function alertUser(query, text) {
  await api.answerCallbackQuery({
    callback_query_id: query.id,
    text,
    show_alert: true
  });
}

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
      await alertUser(query, "دسترسی غیرمجاز");
      return;
    }

    const [, action, idString] = data.split(":");
    const projectId = Number(idString);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      await alertUser(query, "شناسه پروژه نامعتبر است.");
      return;
    }

    if (action !== "accept" && action !== "decline") {
      await alertUser(query, "عملیات نامعتبر است.");
      return;
    }

    const decision = action === "accept" ? "accepted" : "declined";

    let result;

    try {
      result = await reviewProjectDecision(projectId, decision, userId);
    } catch (error) {
      if (error.code) {
        await alertUser(query, error.message);
        return;
      }

      throw error;
    }

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

    await api.sendMessage({
      chat_id: ADMIN_ID,
      text:
        `پروژه شماره ${projectId} بررسی شد.\n` +
        `وضعیت جدید: ${statusLabel(result.status)}`
    });

    return;
  }

  await api.answerCallbackQuery({
    callback_query_id: query.id
  });
}