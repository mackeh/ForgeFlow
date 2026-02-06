import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { createWorkflowComment, deleteWorkflowComment, listWorkflowComments } from "./collaboration.js";

async function resetCollabFile(testId: string) {
  const file = path.join(os.tmpdir(), `forgeflow-collab-${testId}.json`);
  process.env.COLLAB_FILE = file;
  await rm(file, { force: true });
  return file;
}

test("workflow comments can be created and listed chronologically", async () => {
  await resetCollabFile("comments");
  const workflowId = "wf-1";
  const actor = {
    username: "alice",
    role: "operator",
    permissions: ["workflows:write"]
  };

  const first = await createWorkflowComment({
    workflowId,
    message: "Check selector fallback on submit node.",
    author: actor
  });
  const second = await createWorkflowComment({
    workflowId,
    nodeId: "node-123",
    message: "This branch should use manual approval.",
    author: actor
  });

  const comments = await listWorkflowComments(workflowId);
  assert.equal(comments.length, 2);
  assert.equal(comments[0].id, first.id);
  assert.equal(comments[1].id, second.id);
  assert.equal(comments[1].nodeId, "node-123");
});

test("comment delete enforces author/admin ownership", async () => {
  await resetCollabFile("delete");
  const workflowId = "wf-2";
  const author = {
    username: "alice",
    role: "operator",
    permissions: ["workflows:write"]
  };
  const outsider = {
    username: "bob",
    role: "operator",
    permissions: ["workflows:write"]
  };
  const admin = {
    username: "admin",
    role: "admin",
    permissions: ["*"]
  };

  const comment = await createWorkflowComment({
    workflowId,
    message: "Keep this comment",
    author
  });

  await assert.rejects(
    () =>
      deleteWorkflowComment({
        workflowId,
        commentId: comment.id,
        actor: outsider
      }),
    /Only comment author or admin/
  );

  const removedByAdmin = await deleteWorkflowComment({
    workflowId,
    commentId: comment.id,
    actor: admin
  });
  assert.equal(removedByAdmin, true);
  const comments = await listWorkflowComments(workflowId);
  assert.equal(comments.length, 0);
});
