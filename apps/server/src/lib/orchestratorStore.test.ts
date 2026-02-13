import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "fs/promises";
import os from "os";
import path from "path";
import {
  createOrchestratorJob,
  createOrchestratorRobot,
  listOrchestratorJobs,
  listOrchestratorRobots,
  orchestratorOverview,
  updateOrchestratorJob
} from "./orchestratorStore.js";

test("orchestrator store supports robot + job lifecycle", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ff-orchestrator-"));
  process.env.ORCHESTRATOR_FILE = path.join(dir, "orchestrator.json");

  const robot = await createOrchestratorRobot({
    name: "Robot A",
    mode: "unattended",
    labels: ["finance"]
  });
  assert.equal(robot.mode, "unattended");

  const createdJob = await createOrchestratorJob({
    workflowId: "wf-1",
    mode: "unattended",
    robotId: robot.id
  });
  assert.equal(createdJob.status, "queued");

  const dispatched = await updateOrchestratorJob(createdJob.id, {
    status: "dispatched",
    runId: "run-1"
  });
  assert.equal(dispatched.runId, "run-1");

  const robots = await listOrchestratorRobots();
  const jobs = await listOrchestratorJobs();
  assert.equal(robots.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "dispatched");

  const overview = await orchestratorOverview();
  assert.equal(overview.robotCount, 1);
  assert.equal(overview.dispatchedJobs, 1);
});
