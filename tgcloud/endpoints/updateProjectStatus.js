import { db, EndpointError } from "sdk";
import { eq } from "sdk/db";

import {
  projects,
  projectStatuses
} from "../schema.js";

import {
  isAdmin,
  statusLabel,
  recordActivity,
  notifyClient,
  getProjectById
} from "../lib/common.js";

const ALLOWED_STATUSES = [
  "accepted",
  "developing",
  "testing",
  "finalizing",
  "waiting_client",
  "completed",
  "on_hold",
  "cancelled"
];

export default async function (input, ctx) {
  const user = ctx.initData.user;

  if (!user || !isAdmin(user.id)) {
    throw new EndpointError(
      "شما اجازه تغییر وضعیت پروژه را ندارید."
    );
  }

  const projectId = Number(input.projectId);
  const newStatus = String(input.status || "");
  const note = String(input.note || "").trim();

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new EndpointError("شناسه پروژه نامعتبر است.");
  }

  if (!ALLOWED_STATUSES.includes(newStatus)) {
    throw new EndpointError("وضعیت انتخاب‌شده معتبر نیست.");
  }

  if (note.length > 2000) {
    throw new EndpointError("یادداشت بیش از حد طولانی است.");
  }

  const project = await getProjectById(projectId);

  if (!project) {
    throw new EndpointError("پروژه پیدا نشد.");
  }

  if (
    project.status === "declined" ||
    project.status === "cancelled"
  ) {
    throw new EndpointError(
      "وضعیت این پروژه قابل تغییر نیست."
    );
  }

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
    Number(user.id),
    "status_changed",
    `${project.status} → ${newStatus}${note ? ` | ${note}` : ""}`
  );

  const updatedProject = {
    ...project,
    status: newStatus
  };

  await notifyClient(
    updatedProject,
    `به‌روزرسانی پروژه شما\n\n` +
    `عنوان: ${project.title}\n` +
    `وضعیت جدید: ${statusLabel(newStatus)}` +
    (note ? `\n\nتوضیحات:\n${note}` : "")
  );

  return {
    success: true,
    status: newStatus,
    statusLabel: statusLabel(newStatus)
  };
}