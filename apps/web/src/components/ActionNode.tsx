import { useEffect, useState } from "react";
import { Handle, Position } from "reactflow";
import { API_URL } from "../api";
import { imagePathToUrl } from "../utils";

export function ActionNode({ data }: any) {
  const previewUrl = data?.type === "desktop_click_image" ? imagePathToUrl(API_URL, data.imagePath) : null;
  const runStatus = String(data?.__runStatus || "");
  const runDurationMs =
    typeof data?.__runDurationMs === "number" && Number.isFinite(Number(data.__runDurationMs))
      ? Number(data.__runDurationMs)
      : null;
  const runStartedAt = data?.__runStartedAt ? Date.parse(String(data.__runStartedAt)) : NaN;
  const runAttempts = typeof data?.__runAttempts === "number" ? Number(data.__runAttempts) : null;
  const runError = data?.__runError ? String(data.__runError) : "";
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (runStatus !== "running") return;
    if (!Number.isFinite(runStartedAt)) return;
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 500);
    return () => window.clearInterval(timer);
  }, [runStatus, runStartedAt]);

  const liveDurationMs =
    runDurationMs !== null
      ? runDurationMs
      : runStatus === "running" && Number.isFinite(runStartedAt)
      ? Math.max(0, nowTick - runStartedAt)
      : null;
  const details: string[] = [];
  if (data?.selector) details.push(`Selector: ${data.selector}`);
  if (typeof data?.confidence === "number") {
    const conf = data.confidence;
    details.push(`Match confidence: ${conf}`);
  }
  if (runError) {
    details.push(`Error: ${runError}`);
  }

  const tooltip = details.join("\n");

  return (
    <div className={`node-card ${runStatus ? `node-${runStatus}` : ""}`} data-has-tooltip={Boolean(tooltip)}>
      {tooltip ? (
        <div className="node-tooltip">
          {details.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
      <Handle type="target" position={Position.Top} />
      <div className="node-title">{data.label || data.type}</div>
      <div className="node-type">{data.type}</div>
      {runStatus ? <div className={`node-run-status status-${runStatus}`}>{runStatus}</div> : null}
      {liveDurationMs !== null ? (
        <div className="node-runtime">
          {liveDurationMs}ms
          {runAttempts && runAttempts > 1 ? ` · ${runAttempts} attempts` : ""}
        </div>
      ) : null}
      {previewUrl ? <img src={previewUrl} className="node-thumb" alt="Target" /> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
