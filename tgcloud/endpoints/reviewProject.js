import { db, EndpointError } from "sdk";
import { eq } from "sdk/db";

import {
  projects
} from "../schema.js";

import {
  isAdmin,
  statusLabel,
  recordActivity,
  notifyClient,
  getProjectById
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

  const project = await getProjectById(projectId);

  if (!project) {
    throw new EndpointError("پروژه پیدا نشد.");
  }

  if (project.status !== "pending") {
    throw new EndpointError(
      "این پروژه قبلاً بررسی شده است."
    );
  }

  await db
    .update(projects)
    .set({
      status: decision,
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(projects.id, projectId))
    .run();

  await recordActivity(
    projectId,
    Number(user.id),
    decision,
    "بررسی درخواست توسط مدیر"
  );

  await notifyClient(
    {
      ...project,
      status: decision
    },
    decision === "accepted"
      ? `پروژه «${project.title}» پذیرفته شد.\n\nوضعیت: ${statusLabel(decision)}`
      : `پروژه «${project.title}» پذیرفته نشد.`
  );

  return {
    success: true,
    projectId,
    status: decision,
    statusLabel: statusLabel(decision)
  };
}