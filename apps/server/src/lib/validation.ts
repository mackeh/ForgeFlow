import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, strict: false });

export function validateWithSchema(value: unknown, schema: unknown) {
  if (!schema || typeof schema !== "object") {
    return { ok: true as const, errors: [] as string[] };
  }

  const validate = ajv.compile(schema as Record<string, unknown>);
  const ok = validate(value) as boolean;
  if (ok) {
    return { ok: true as const, errors: [] as string[] };
  }

  const errors = (validate.errors || []).map((err) => {
    const loc = err.instancePath || "/";
    return `${loc} ${err.message || "invalid"}`;
  });
  return { ok: false as const, errors };
}

export function deterministicFallback(
  input: unknown,
  schema: unknown,
  mode: "passthrough" | "normalize" | "pick_object" = "normalize"
) {
  if (mode === "passthrough") return input;

  if (mode === "pick_object" && input && typeof input === "object" && schema && typeof schema === "object") {
    const properties = (schema as any).properties || {};
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(properties)) {
      out[key] = (input as Record<string, unknown>)[key];
    }
    return out;
  }

  if (typeof input === "string") {
    return input.replace(/\s+/g, " ").trim();
  }

  return input;
}

export function validateRecord(value: unknown, rules: any) {
  const errors: string[] = [];
  const obj = (value || {}) as Record<string, unknown>;

  for (const requiredField of rules?.requiredFields || []) {
    if (obj[requiredField] === undefined || obj[requiredField] === null || obj[requiredField] === "") {
      errors.push(`Missing required field: ${requiredField}`);
    }
  }

  const patterns = rules?.patterns || {};
  for (const key of Object.keys(patterns)) {
    if (obj[key] === undefined || obj[key] === null) continue;
    const regex = new RegExp(patterns[key]);
    if (!regex.test(String(obj[key]))) {
      errors.push(`Pattern mismatch for ${key}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function parseJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Extract first JSON object/array block from model output.
    const firstObj = trimmed.match(/\{[\s\S]*\}/);
    if (firstObj) return JSON.parse(firstObj[0]);
    const firstArr = trimmed.match(/\[[\s\S]*\]/);
    if (firstArr) return JSON.parse(firstArr[0]);
    throw new Error("Model output is not valid JSON");
  }
}
