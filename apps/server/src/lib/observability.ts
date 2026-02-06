type Primitive = string | number | boolean;

type LabelValue = Primitive | null | undefined;

type Labels = Record<string, LabelValue>;

type HistogramState = {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
};

const defaultRequestDurationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];

function escapeLabelValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function normalizeLabels(labels: Labels = {}) {
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries;
}

function keyFor(name: string, labels: Labels = {}) {
  const entries = normalizeLabels(labels);
  if (!entries.length) return name;
  return `${name}|${entries.map(([k, v]) => `${k}=${v}`).join(",")}`;
}

function renderLabelSet(labels: Labels = {}) {
  const entries = normalizeLabels(labels);
  if (!entries.length) return "";
  return `{${entries.map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(",")}}`;
}

function metricName(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_:]/g, "_");
}

export function normalizeRequestPath(path: string) {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+\b/g, "/:id")
    .replace(/\/[a-zA-Z0-9_-]{20,}\b/g, "/:id");
}

export function statusClass(statusCode: number) {
  const base = Math.floor(statusCode / 100);
  if (base < 1 || base > 5) return "other";
  return `${base}xx`;
}

export class ObservabilityRegistry {
  private counters = new Map<string, { name: string; labels: Labels; value: number }>();
  private gauges = new Map<string, { name: string; labels: Labels; value: number }>();
  private histograms = new Map<string, { name: string; labels: Labels; state: HistogramState }>();

  incrementCounter(name: string, labels: Labels = {}, value = 1) {
    const normalizedName = metricName(name);
    const key = keyFor(normalizedName, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
      return;
    }
    this.counters.set(key, { name: normalizedName, labels, value });
  }

  setGauge(name: string, value: number, labels: Labels = {}) {
    const normalizedName = metricName(name);
    const key = keyFor(normalizedName, labels);
    this.gauges.set(key, { name: normalizedName, labels, value });
  }

  incrementGauge(name: string, delta = 1, labels: Labels = {}) {
    const normalizedName = metricName(name);
    const key = keyFor(normalizedName, labels);
    const existing = this.gauges.get(key);
    if (!existing) {
      this.gauges.set(key, { name: normalizedName, labels, value: delta });
      return;
    }
    existing.value += delta;
  }

  observeHistogram(name: string, value: number, labels: Labels = {}, buckets = defaultRequestDurationBuckets) {
    const normalizedName = metricName(name);
    const safeBuckets = buckets.slice().sort((a, b) => a - b);
    const key = keyFor(normalizedName, labels);
    let entry = this.histograms.get(key);
    if (!entry) {
      entry = {
        name: normalizedName,
        labels,
        state: {
          buckets: safeBuckets,
          counts: safeBuckets.map(() => 0),
          sum: 0,
          count: 0
        }
      };
      this.histograms.set(key, entry);
    }
    entry.state.count += 1;
    entry.state.sum += value;
    entry.state.buckets.forEach((bound, idx) => {
      if (value <= bound) {
        entry!.state.counts[idx] += 1;
      }
    });
  }

  renderPrometheus(extraGauges: Array<{ name: string; value: number; labels?: Labels }> = []) {
    const lines: string[] = [];

    const counterItems = Array.from(this.counters.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const counter of counterItems) {
      lines.push(`${counter.name}${renderLabelSet(counter.labels)} ${counter.value}`);
    }

    const gaugeItems = [
      ...Array.from(this.gauges.values()).sort((a, b) => a.name.localeCompare(b.name)),
      ...extraGauges.map((gauge) => ({
        name: metricName(gauge.name),
        labels: gauge.labels || {},
        value: gauge.value
      }))
    ];
    for (const gauge of gaugeItems) {
      lines.push(`${gauge.name}${renderLabelSet(gauge.labels)} ${gauge.value}`);
    }

    const histogramItems = Array.from(this.histograms.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const histogram of histogramItems) {
      let cumulative = 0;
      histogram.state.buckets.forEach((bound, idx) => {
        cumulative += histogram.state.counts[idx];
        const labels = { ...histogram.labels, le: String(bound) };
        lines.push(`${histogram.name}_bucket${renderLabelSet(labels)} ${cumulative}`);
      });
      lines.push(`${histogram.name}_bucket${renderLabelSet({ ...histogram.labels, le: "+Inf" })} ${histogram.state.count}`);
      lines.push(`${histogram.name}_sum${renderLabelSet(histogram.labels)} ${histogram.state.sum}`);
      lines.push(`${histogram.name}_count${renderLabelSet(histogram.labels)} ${histogram.state.count}`);
    }

    return `${lines.join("\n")}\n`;
  }
}

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return error;
}

function shouldLogLevel(level: LogLevel, minimum: LogLevel) {
  const order: Record<LogLevel, number> = { info: 20, warn: 30, error: 40 };
  return order[level] >= order[minimum];
}

export function createStructuredLogger(service = "forgeflow-server", minimumLevel: LogLevel = "info") {
  const write = (level: LogLevel, message: string, payload: LogPayload = {}) => {
    if (!shouldLogLevel(level, minimumLevel)) return;
    const normalizedPayload = { ...payload } as Record<string, unknown>;
    if ("error" in normalizedPayload) {
      normalizedPayload.error = normalizeError(normalizedPayload.error);
    }
    const line = {
      ts: new Date().toISOString(),
      level,
      service,
      msg: message,
      ...normalizedPayload
    };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  };
  return {
    info: (message: string, payload?: LogPayload) => write("info", message, payload),
    warn: (message: string, payload?: LogPayload) => write("warn", message, payload),
    error: (message: string, payload?: LogPayload) => write("error", message, payload)
  };
}

