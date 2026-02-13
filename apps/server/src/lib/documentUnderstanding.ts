export type DocumentUnderstandingResult = {
  rawText: string;
  fields: Record<string, string | null>;
  entities: Array<{ key: string; value: string }>;
  confidence: number;
};

function cleanText(value: string) {
  return value.replace(/\r/g, "").trim();
}

function parseKeyValueLines(text: string) {
  const fields: Record<string, string | null> = {};
  const entities: Array<{ key: string; value: string }> = [];
  for (const line of text.split("\n")) {
    const raw = line.trim();
    if (!raw) continue;
    const idx = raw.indexOf(":");
    if (idx <= 0) continue;
    const key = raw.slice(0, idx).trim().toLowerCase().replace(/\s+/g, "_");
    const value = raw.slice(idx + 1).trim();
    if (!key || !value) continue;
    fields[key] = value;
    entities.push({ key, value });
  }
  return { fields, entities };
}

function applyHeuristics(text: string, fields: Record<string, string | null>, entities: Array<{ key: string; value: string }>) {
  const upsert = (key: string, value: string | undefined) => {
    const clean = String(value || "").trim();
    if (!clean || fields[key]) return;
    fields[key] = clean;
    entities.push({ key, value: clean });
  };

  const invoiceMatch = text.match(/\b(invoice|inv)\s*(no|number|#)?\s*[:#-]?\s*([A-Za-z0-9-]+)/i);
  upsert("invoice_number", invoiceMatch?.[3]);

  const totalMatch = text.match(/\b(total|amount\s+due)\b[^0-9$€£]*([$€£]?\s*[0-9][0-9,]*(?:\.[0-9]{2})?)/i);
  upsert("total_amount", totalMatch?.[2]);

  const dateMatch = text.match(/\b(date|invoice_date)\b[^0-9]*(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})/i);
  upsert("invoice_date", dateMatch?.[2]);

  const dueMatch = text.match(/\b(due\s*date)\b[^0-9]*(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})/i);
  upsert("due_date", dueMatch?.[2]);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  upsert("contact_email", emailMatch?.[0]);
}

export function understandDocument(input: {
  text: string;
  expectedFields?: string[];
}): DocumentUnderstandingResult {
  const rawText = cleanText(input.text || "");
  if (!rawText) {
    return {
      rawText: "",
      fields: {},
      entities: [],
      confidence: 0
    };
  }

  const { fields, entities } = parseKeyValueLines(rawText);
  applyHeuristics(rawText, fields, entities);

  const expected = Array.isArray(input.expectedFields)
    ? input.expectedFields.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];

  for (const key of expected) {
    if (!(key in fields)) {
      fields[key] = null;
    }
  }

  const expectedFound = expected.length ? expected.filter((key) => fields[key]).length : 0;
  const heuristicFound = Object.values(fields).filter((value) => value).length;
  const denominator = expected.length ? expected.length : Math.max(1, heuristicFound);
  const numerator = expected.length ? expectedFound : Math.min(heuristicFound, 6);
  const confidence = Number(Math.min(1, Math.max(0, numerator / denominator)).toFixed(3));

  return {
    rawText,
    fields,
    entities,
    confidence
  };
}
