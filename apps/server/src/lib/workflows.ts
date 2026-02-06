import type { PrismaClient } from "@prisma/client";

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
      definition: definition as any,
      notes
    }
  });
}

export async function publishWorkflow(prisma: PrismaClient, workflowId: string, notes?: string) {
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new Error("Workflow not found");
  const definition = wf.draftDefinition ?? wf.definition;
  if (!definition) throw new Error("No draft definition to publish");

  const version = await ensureWorkflowVersion(prisma, workflowId, definition, "PUBLISHED", notes);
  return prisma.workflow.update({
    where: { id: workflowId },
    data: {
      publishedDefinition: definition as any,
      publishedVersion: version.version,
      definition: definition as any
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
      draftDefinition: definition as any,
      definition: definition as any
    }
  });
}

export async function rollbackWorkflow(prisma: PrismaClient, workflowId: string, version: number) {
  const target = await prisma.workflowVersion.findUnique({
    where: { workflowId_version: { workflowId, version } }
  });
  if (!target) throw new Error("Version not found");

  return prisma.workflow.update({
    where: { id: workflowId },
    data: {
      draftDefinition: target.definition as any,
      definition: target.definition as any,
      publishedDefinition: target.status === "PUBLISHED" ? (target.definition as any) : undefined,
      publishedVersion: target.status === "PUBLISHED" ? target.version : undefined
    }
  });
}

export async function deleteWorkflow(prisma: PrismaClient, workflowId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) {
      throw new Error("Workflow not found");
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
): Promise<{ definition: any; version: number | null }> {
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new Error("Workflow not found");

  if (testMode) {
    const definition = (wf.draftDefinition ?? wf.definition ?? wf.publishedDefinition) as any;
    return { definition, version: wf.publishedVersion ?? null };
  }

  const definition = (wf.publishedDefinition ?? wf.definition ?? wf.draftDefinition) as any;
  return { definition, version: wf.publishedVersion ?? null };
}
