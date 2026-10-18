import { api, db } from "sdk";
import { eq, desc } from "sdk/db";

import { projects } from "../schema.js";

import {
  ADMIN_ID,
  ensureUser,
  isAdmin,
  escapeHtml,
  statusLabel
} from "../lib/common.js";

/*
 * Set this after deploying the Mini App.
 *
 * Telegram Serverless prints the hosted URL after deployment.
 */
const MINI_APP_URL = "https://YOUR_APP_URL";

export default async function (message) {
  if (!message || !message.chat || !message.from) {
    return;
  }

  const chatId = message.chat.id;
  const user = message.from;

  if (message.chat.type !== "private") {
    await api.sendMessage({
      chat_id: chatId,
      text: "لطفاً برای استفاده از سایتورا، در گفتگوی خصوصی ربات اقدام کنید."
    });

    return;
  }

  const text = (message.text || "").trim();

  if (text.startsWith("/start")) {
    await ensureUser(user);

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🚀 ورود به سایتورا",
            web_app: {
              url: MINI_APP_URL
            }
          }
        ],
        [
          {
            text: "📋 راهنمای استفاده",
            callback_data: "help"
          }
        ]
      ]
    };

    let welcome =
      `سلام ${escapeHtml(user.first_name)} عزیز!\n\n` +
      "به سایتورا خوش آمدید.\n\n" +
      "سایتورا سامانه ثبت و مدیریت پروژه‌های فریلنسری است.\n\n" +
      "از طریق برنامه می‌توانید پروژه جدید ثبت کنید و وضعیت پروژه‌های خود را پیگیری کنید.";

    if (isAdmin(user.id)) {
      welcome += "\n\nشما به عنوان مدیر سامانه شناسایی شده‌اید.";
    }

    await api.sendMessage({
      chat_id: chatId,
      text: welcome,
      parse_mode: "HTML",
      reply_markup: keyboard
    });

    return;
  }

  if (text === "/help") {
    await api.sendMessage({
      chat_id: chatId,
      text:
        "راهنمای سایتورا\n\n" +
        "/start - ورود به سامانه\n" +
        "/help - راهنمای استفاده\n" +
        "/projects - مشاهده پروژه‌های شما\n" +
        (isAdmin(user.id)
          ? "/admin - پنل مدیریت پروژه‌ها\n"
          : "") +
        "\nبرای ثبت پروژه یا مشاهده جزئیات، برنامه سایتورا را باز کنید."
    });

    return;
  }

  if (text === "/admin") {
    if (!isAdmin(user.id)) {
      await api.sendMessage({
        chat_id: chatId,
        text: "شما اجازه دسترسی به پنل مدیریت را ندارید."
      });

      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: "پنل مدیریت سایتورا",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🚀 باز کردن پنل مدیریت",
              web_app: {
                url: MINI_APP_URL
              }
            }
          ]
        ]
      }
    });

    return;
  }

  if (text === "/projects") {
    await ensureUser(user);

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.clientId, Number(user.id)))
      .orderBy(desc(projects.createdAt))
      .all();

    if (!rows.length) {
      await api.sendMessage({
        chat_id: chatId,
        text: "هنوز پروژه‌ای ثبت نکرده‌اید."
      });

      return;
    }

    const output = rows.slice(0, 20).map(project =>
      `#${project.id} — ${escapeHtml(project.title)}\n` +
      `وضعیت: ${statusLabel(project.status)}`
    );

    await api.sendMessage({
      chat_id: chatId,
      text: output.join("\n\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "مشاهده همه پروژه‌ها",
              web_app: {
                url: MINI_APP_URL
              }
            }
          ]
        ]
      }
    });

    return;
  }

  await api.sendMessage({
    chat_id: chatId,
    text:
      "برای استفاده از سایتورا، دستور /start را ارسال کنید و برنامه را باز کنید."
  });
}