type AnyRecord = Record<string, any>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createInMemoryRunnerPrisma(seed: {
  workflow: AnyRecord;
  run: AnyRecord;
  workflowVersions?: AnyRecord[];
}) {
  const workflows = new Map<string, AnyRecord>([[seed.workflow.id, clone(seed.workflow)]]);
  const runs = new Map<string, AnyRecord>([[seed.run.id, clone(seed.run)]]);
  const versions = new Map<string, AnyRecord>();

  for (const version of seed.workflowVersions || []) {
    versions.set(`${version.workflowId}:${version.version}`, clone(version));
  }

  const prisma = {
    workflow: {
      findUnique: async ({ where }: AnyRecord) => {
        const row = workflows.get(where.id);
        return row ? clone(row) : null;
      }
    },
    workflowVersion: {
      findUnique: async ({ where }: AnyRecord) => {
        const key = `${where.workflowId_version.workflowId}:${where.workflowId_version.version}`;
        const row = versions.get(key);
        return row ? clone(row) : null;
      }
    },
    run: {
      findUnique: async ({ where, include }: AnyRecord) => {
        const row = runs.get(where.id);
        if (!row) return null;
        const out = clone(row);
        if (include?.workflow) {
          const wf = workflows.get(out.workflowId);
          if (!wf) return null;
          out.workflow = clone(wf);
        }
        return out;
      },
      update: async ({ where, data }: AnyRecord) => {
        const current = runs.get(where.id);
        if (!current) throw new Error("Run not found");
        const next = { ...current, ...clone(data) };
        runs.set(where.id, next);
        return clone(next);
      }
    }
  } as any;

  return {
    prisma,
    getRun: (id: string) => {
      const row = runs.get(id);
      return row ? clone(row) : null;
    },
    updateRun: (id: string, data: AnyRecord) => {
      const current = runs.get(id);
      if (!current) throw new Error("Run not found");
      runs.set(id, { ...current, ...clone(data) });
    }
  };
}
