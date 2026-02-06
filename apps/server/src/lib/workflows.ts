import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "./errors.js";
import { asWorkflowDefinition, type WorkflowDefinition } from "./types.js";

function asInputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

export async function ensureWorkflowVersion(
  prisma: PrismaClient,
  workflowId: string,
  definition: unknown,
  status: "DRAFT" | "PUBLISHED",
  notes?: string
) {
  const latest = await prisma.workflowVersion.findFirst({
    where: { workflowId },
    orderBy: { version: "desc" }
  });
  const version = (latest?.version || 0) + 1;
  return prisma.workflowVersion.create({
    data: {
      workflowId,
      version,
      status,
      definition: asInputJson(definition),
      notes
    }
  });
}

export async function publishWorkflow(prisma: PrismaClient, workflowId: string, notes?: string) {
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
  const definition = wf.draftDefinition ?? wf.definition;
  if (!definition) throw new AppError(400, "MISSING_DRAFT", "No draft definition to publish");

  const version = await ensureWorkflowVersion(prisma, workflowId, definition, "PUBLISHED", notes);
  return prisma.workflow.update({
    where: { id: workflowId },
    data: {
      publishedDefinition: asInputJson(definition),
      publishedVersion: version.version,
      definition: asInputJson(definition)
    }
  });
}

export async function saveDraftWorkflow(
  prisma: PrismaClient,
  workflowId: string,
  definition: unknown,
  notes?: string
) {
  await ensureWorkflowVersion(prisma, workflowId, definition, "DRAFT", notes);
  return prisma.workflow.update({
    where: { id: workflowId },
    data: {
      draftDefinition: asInputJson(definition),
      definition: asInputJson(definition)
    }
  });
}

export async function rollbackWorkflow(prisma: PrismaClient, workflowId: string, version: number) {
  const target = await prisma.workflowVersion.findUnique({
    where: { workflowId_version: { workflowId, version } }
  });
  if (!target) throw new AppError(404, "VERSION_NOT_FOUND", "Version not found");

  return prisma.workflow.update({
    where: { id: workflowId },
    data: {
      draftDefinition: asInputJson(target.definition),
      definition: asInputJson(target.definition),
      publishedDefinition: target.status === "PUBLISHED" ? asInputJson(target.definition) : undefined,
      publishedVersion: target.status === "PUBLISHED" ? target.version : undefined
    }
  });
}

export async function deleteWorkflow(prisma: PrismaClient, workflowId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) {
      throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
    }
    await tx.run.deleteMany({ where: { workflowId } });
    await tx.workflowVersion.deleteMany({ where: { workflowId } });
    await tx.workflow.delete({ where: { id: workflowId } });
  });
}

export async function getWorkflowDefinitionForRun(
  prisma: PrismaClient,
  workflowId: string,
  testMode: boolean
): Promise<{ definition: WorkflowDefinition; version: number | null }> {
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");

  if (testMode) {
    const definition = asWorkflowDefinition(wf.draftDefinition ?? wf.definition ?? wf.publishedDefinition);
    return { definition, version: wf.publishedVersion ?? null };
  }

  const definition = asWorkflowDefinition(wf.publishedDefinition ?? wf.definition ?? wf.draftDefinition);
  return { definition, version: wf.publishedVersion ?? null };
}
