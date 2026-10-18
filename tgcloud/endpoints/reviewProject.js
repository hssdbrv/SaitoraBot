import { EndpointError } from "sdk";

import {
  isAdmin,
  reviewProjectDecision
} from "../lib/common.js";

export default async function (input, ctx) {
  const user = ctx.initData.user;

  if (!user || !isAdmin(user.id)) {
    throw new EndpointError(
      "فقط مدیر می‌تواند پروژه را بررسی کند."
    );
  }

  const projectId = Number(input.projectId);
  const decision = String(input.decision || "");

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new EndpointError("شناسه پروژه نامعتبر است.");
  }

  if (!["accepted", "declined"].includes(decision)) {
    throw new EndpointError("تصمیم انتخاب‌شده معتبر نیست.");
  }

  try {
    const result = await reviewProjectDecision(
      projectId,
      decision,
      user.id
    );

    return {
      success: true,
      projectId,
      status: result.status,
      statusLabel: result.statusLabel
    };
  } catch (error) {
    if (error.code) {
      throw new EndpointError(error.message, { code: error.code });
    }

    throw error;
  }
}
