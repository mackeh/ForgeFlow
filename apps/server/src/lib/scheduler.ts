import type { PrismaClient } from "@prisma/client";
import cron, { type ScheduledTask } from "node-cron";
import { getWorkflowDefinitionForRun } from "./workflows.js";
import { startRun } from "./runner.js";
import { getSchedule, listSchedules, updateSchedule } from "./scheduleStore.js";

function formatLocal(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export class WorkflowScheduler {
  private tasks = new Map<string, ScheduledTask>();
  private running = new Set<string>();
  private tickTimer: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaClient) {}

  async start() {
    await this.refresh();
    this.tickTimer = setInterval(() => {
      this.refresh().catch((error) => console.error("[scheduler] refresh failed", error));
    }, 60_000);
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    this.running.clear();
  }

  async refresh() {
    const schedules = await listSchedules();
    const activeIds = new Set(schedules.filter((schedule) => schedule.enabled).map((schedule) => schedule.id));

    for (const [id, task] of this.tasks.entries()) {
      if (!activeIds.has(id)) {
        task.stop();
        this.tasks.delete(id);
      }
    }

    for (const schedule of schedules) {
      const existing = this.tasks.get(schedule.id);
      if (!schedule.enabled) continue;
      if (existing) {
        const taskCron = (existing as any)?.cronTime?.source;
        if (taskCron === schedule.cron) continue;
        existing.stop();
        this.tasks.delete(schedule.id);
      }

      const task = cron.schedule(
        schedule.cron,
        () => {
          this.execute(schedule.id).catch((error) => {
            console.error(`[scheduler] execute failed for ${schedule.id}`, error);
          });
        },
        { timezone: schedule.timezone }
      );
      this.tasks.set(schedule.id, task);
    }
  }

  async runNow(scheduleId: string) {
    if (this.running.has(scheduleId)) {
      return false;
    }
    await this.execute(scheduleId);
    return true;
  }

  private async execute(scheduleId: string) {
    if (this.running.has(scheduleId)) return;
    this.running.add(scheduleId);

    try {
      const schedule = await getSchedule(scheduleId);
      if (!schedule || !schedule.enabled) return;

      const workflow = await this.prisma.workflow.findUnique({ where: { id: schedule.workflowId } });
      if (!workflow) {
        await updateSchedule(scheduleId, {
          lastRunAt: new Date().toISOString(),
          lastRunStatus: "FAILED",
          lastRunError: "Workflow no longer exists"
        });
        return;
      }

      const { version } = await getWorkflowDefinitionForRun(this.prisma, schedule.workflowId, schedule.testMode);
      const now = new Date();
      const localTimestamp = formatLocal(now, schedule.timezone);

      const run = await this.prisma.run.create({
        data: {
          workflowId: schedule.workflowId,
          workflowVersion: version,
          testMode: schedule.testMode,
          inputData: {
            ...(typeof schedule.inputData === "object" && schedule.inputData ? (schedule.inputData as Record<string, unknown>) : {}),
            __schedule: {
              id: schedule.id,
              name: schedule.name,
              timezone: schedule.timezone,
              firedAtLocal: localTimestamp,
              firedAtUtc: now.toISOString()
            }
          }
        }
      });

      await updateSchedule(scheduleId, {
        lastRunAt: now.toISOString(),
        lastRunStatus: "PENDING",
        lastRunError: ""
      });

      startRun(this.prisma, run.id)
        .then(async () => {
          const finalRun = await this.prisma.run.findUnique({ where: { id: run.id } });
          await updateSchedule(scheduleId, {
            lastRunAt: new Date().toISOString(),
            lastRunStatus: finalRun?.status || "FAILED",
            lastRunError: finalRun?.status === "FAILED" ? "Run failed" : ""
          });
        })
        .catch(async (error) => {
          await updateSchedule(scheduleId, {
            lastRunAt: new Date().toISOString(),
            lastRunStatus: "FAILED",
            lastRunError: String(error)
          });
        });
    } finally {
      this.running.delete(scheduleId);
    }
  }
}
