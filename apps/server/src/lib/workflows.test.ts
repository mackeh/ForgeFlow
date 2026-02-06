import test from "node:test";
import assert from "node:assert/strict";
import { deleteWorkflow, ensureWorkflowVersion, getWorkflowDefinitionForRun } from "./workflows.js";

test("ensureWorkflowVersion increments version", async () => {
  const created: any[] = [];
  const prisma = {
    workflowVersion: {
      findFirst: async () => ({ version: 2 }),
      create: async ({ data }: any) => {
        created.push(data);
        return { id: "v3", ...data };
      }
    }
  } as any;

  const version = await ensureWorkflowVersion(prisma, "wf1", { nodes: [] }, "DRAFT", "note");
  assert.equal(version.version, 3);
  assert.equal(created[0].workflowId, "wf1");
});

test("getWorkflowDefinitionForRun prefers draft in test mode", async () => {
  const prisma = {
    workflow: {
      findUnique: async () => ({
        draftDefinition: { nodes: [{ id: "d" }] },
        definition: { nodes: [{ id: "base" }] },
        publishedDefinition: { nodes: [{ id: "p" }] },
        publishedVersion: 7
      })
    }
  } as any;

  const testDef = await getWorkflowDefinitionForRun(prisma, "wf1", true);
  const prodDef = await getWorkflowDefinitionForRun(prisma, "wf1", false);

  assert.equal(testDef.definition.nodes[0].id, "d");
  assert.equal(prodDef.definition.nodes[0].id, "p");
  assert.equal(prodDef.version, 7);
});

test("deleteWorkflow removes runs and versions before workflow", async () => {
  const order: string[] = [];
  const tx = {
    workflow: {
      findUnique: async () => ({ id: "wf1" }),
      delete: async () => {
        order.push("workflow");
      }
    },
    run: {
      deleteMany: async () => {
        order.push("runs");
      }
    },
    workflowVersion: {
      deleteMany: async () => {
        order.push("versions");
      }
    }
  };
  const prisma = {
    $transaction: async (fn: any) => fn(tx)
  } as any;

  await deleteWorkflow(prisma, "wf1");
  assert.deepEqual(order, ["runs", "versions", "workflow"]);
});
