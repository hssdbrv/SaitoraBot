import { db, EndpointError } from "sdk";
import { eq, desc } from "sdk/db";

import {
  projects,
  projectActivity
} from "../schema.js";

import {
  isAdmin,
  statusLabel
} from "../lib/common.js";

export default async function (input, ctx) {
  const user = ctx.initData.user;

  if (!user) {
    throw new EndpointError("کاربر شناسایی نشد.");
  }

  const projectId = Number(input.projectId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new EndpointError("شناسه پروژه نامعتبر است.");
  }

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) {
    throw new EndpointError("پروژه پیدا نشد.");
  }

  if (
    !isAdmin(user.id) &&
    Number(project.clientId) !== Number(user.id)
  ) {
    throw new EndpointError(
      "شما اجازه مشاهده این پروژه را ندارید."
    );
  }

  const activity = await db
    .select()
    .from(projectActivity)
    .where(eq(projectActivity.projectId, projectId))
    .orderBy(desc(projectActivity.createdAt))
    .all();

  return {
    project: {
      ...project,
      statusLabel: statusLabel(project.status)
    },
    activity
  };
}