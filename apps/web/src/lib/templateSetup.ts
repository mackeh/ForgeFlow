import type { TemplateSetupGuide } from "../types";

type IntegrationLike = { id?: string; name?: string; type?: string };

export function buildTemplateSetupInitialValues(setup?: TemplateSetupGuide | null) {
  const next: Record<string, string> = {};
  for (const field of setup?.requiredInputs || []) {
    next[field.id] = field.defaultValue || "";
  }
  return next;
}

export function buildTemplateSetupProgress(setup: TemplateSetupGuide | null | undefined, values: Record<string, string>) {
  const requiredFields = (setup?.requiredInputs || []).filter((field) => field.required);
  const requiredTotal = requiredFields.length;
  const requiredDone = requiredFields.filter((field) => String(values[field.id] || "").trim().length > 0).length;
  return {
    requiredTotal,
    requiredDone,
    requiredComplete: requiredTotal === 0 || requiredDone >= requiredTotal
  };
}

export function integrationExists(
  integrationId: string | undefined,
  integrations: IntegrationLike[] | null | undefined
): boolean {
  if (!integrationId) return true;
  const target = integrationId.trim().toLowerCase();
  if (!target) return true;
  return (integrations || []).some((item) => {
    const byId = String(item?.id || "").trim().toLowerCase();
    const byName = String(item?.name || "").trim().toLowerCase();
    return byId === target || byName === target;
  });
}

export function resolveIntegrationCheckId(args: {
  setup?: TemplateSetupGuide | null;
  values?: Record<string, string>;
  integrationId?: string;
}) {
  const integrationId = String(args.integrationId || "").trim();
  if (!integrationId) return "";
  const setup = args.setup;
  const values = args.values || {};
  const mappedField = (setup?.requiredInputs || []).find(
    (field) => field.kind === "integration" && (field.defaultValue === integrationId || field.id === integrationId)
  );
  if (!mappedField) return integrationId;
  const override = String(values[mappedField.id] || "").trim();
  return override || mappedField.defaultValue || integrationId;
}

export function buildTemplateReadiness(args: {
  setup?: TemplateSetupGuide | null;
  values?: Record<string, string>;
  integrations?: IntegrationLike[] | null;
  preflightReady?: boolean;
}) {
  const setup = args.setup || null;
  const values = args.values || {};
  const preflightReady = Boolean(args.preflightReady);
  const progress = buildTemplateSetupProgress(setup, values);

  const checkResults = (setup?.connectionChecks || []).map((check) => {
    if (check.type === "preflight") {
      return { id: check.id, ok: preflightReady };
    }
    const integrationTarget = resolveIntegrationCheckId({
      setup,
      values,
      integrationId: check.integrationId
    });
    return {
      id: check.id,
      ok: integrationExists(integrationTarget, args.integrations)
    };
  });

  const checksReady = checkResults.every((item) => item.ok);
  return {
    ...progress,
    checksReady,
    ready: progress.requiredComplete && checksReady,
    checkResults
  };
}
