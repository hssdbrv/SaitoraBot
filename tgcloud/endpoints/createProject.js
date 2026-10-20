import { db } from "sdk";
import { EndpointError } from "sdk";
import { eq } from "sdk/db";

import {
  projects
} from "../schema.js";

import {
  ensureUser,
  isAdmin,
  notifyAdmin,
  recordActivity,
  escapeHtml
} from "../lib/common.js";

const MAX_PENDING_PER_USER = 3;

// Telegram messages are limited to 4096 characters.
const ALERT_DESCRIPTION_LIMIT = 2500;
const ALERT_ESCAPED_LIMIT = 3000;

function shortenForAlert(text) {
  if (text.length <= ALERT_DESCRIPTION_LIMIT) {
    return escapeHtml(text);
  }

  let short = text.slice(0, ALERT_DESCRIPTION_LIMIT);

  // Escaping (&amp; etc.) can make the text longer.
  while (escapeHtml(short).length > ALERT_ESCAPED_LIMIT) {
    short = short.slice(0, Math.floor(short.length * 0.8));
  }

  return escapeHtml(short) + "…\n\n(متن کامل در برنامه سایتورا)";
}

export default async function (input, ctx) {
  const user = ctx.initData.user;

  if (!user) {
    throw new EndpointError("کاربر تلگرام شناسایی نشد.");
  }

  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const category = String(input.category || "").trim();
  const budget = String(input.budget || "").trim();
  const deadline = String(input.deadline || "").trim();

  if (title.length < 3 || title.length > 120) {
    throw new EndpointError(
      "عنوان پروژه باید بین ۳ تا ۱۲۰ نویسه باشد."
    );
  }

  if (description.length < 10 || description.length > 10000) {
    throw new EndpointError(
      "توضیحات پروژه باید بین ۱۰ تا ۱۰۰۰۰ نویسه باشد."
    );
  }

  const allowedCategories = [
    "web",
    "bot",
    "mobile",
    "desktop",
    "other"
  ];

  if (!allowedCategories.includes(category)) {
    throw new EndpointError(
      "دسته‌بندی پروژه معتبر نیست."
    );
  }

  if (budget.length > 100 || deadline.length > 100) {
    throw new EndpointError(
      "اطلاعات بودجه یا مهلت تحویل بیش از حد طولانی است."
    );
  }

  await ensureUser(user);

  if (!isAdmin(user.id)) {
    const pending = await db
      .select()
      .from(projects)
      .where(
        eq(projects.clientId, Number(user.id)),
        eq(projects.status, "pending")
      )
      .all();

    if (pending.length >= MAX_PENDING_PER_USER) {
      throw new EndpointError(
        `شما در حال حاضر ${MAX_PENDING_PER_USER} درخواست در انتظار بررسی دارید. ` +
        "لطفاً تا بررسی آن‌ها صبر کنید."
      );
    }
  }

  const [project] = await db
    .insert(projects)
    .values({
      clientId: Number(user.id),
      title,
      description,
      category,
      budget: budget || null,
      deadline: deadline || null,
      status: "pending"
    })
    .returning()
    .run();

  await recordActivity(
    project.id,
    Number(user.id),
    "created",
    "درخواست پروژه ثبت شد."
  );

  const categoryLabels = {
    web: "طراحی وب",
    bot: "توسعه ربات",
    mobile: "توسعه اپلیکیشن موبایل",
    desktop: "توسعه نرم‌افزار دسکتاپ",
    other: "سایر"
  };

  const adminMessage =
    `<b>درخواست پروژه جدید</b>\n\n` +
    `شناسه: <code>SAI-${project.id}</code>\n` +
    `عنوان: ${escapeHtml(title)}\n` +
    `دسته‌بندی: ${categoryLabels[category]}\n` +
    `بودجه: ${escapeHtml(budget || "تعیین نشده")}\n` +
    `مهلت تحویل: ${escapeHtml(deadline || "تعیین نشده")}\n\n` +
    `<b>توضیحات:</b>\n${shortenForAlert(description)}\n\n` +
    `نام مشتری: ${escapeHtml(user.first_name || "کاربر")}\n` +
    `شناسه تلگرام: <code>${user.id}</code>`;

  await notifyAdmin(adminMessage, {
    inline_keyboard: [
      [
        {
          text: "✅ پذیرش پروژه",
          callback_data: `review:accept:${project.id}`
        },
        {
          text: "❌ رد پروژه",
          callback_data: `review:decline:${project.id}`
        }
      ]
    ]
  });

  return {
    success: true,
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      statusLabel: "در انتظار بررسی"
    }
  };
}
