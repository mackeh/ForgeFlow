import { Handle, Position } from "reactflow";
import { API_URL } from "../api";
import { imagePathToUrl } from "../utils";

export function ActionNode({ data }: any) {
  const previewUrl = data?.type === "desktop_click_image" ? imagePathToUrl(API_URL, data.imagePath) : null;
  const details: string[] = [];
  if (data?.selector) details.push(`Selector: ${data.selector}`);
  if (data?.type === "desktop_click_image") {
    const conf = data?.confidence ?? 0.8;
    details.push(`Match confidence: ${conf}`);
  }

  const tooltip = details.join("\n");

  return (
    <div className="node-card" data-has-tooltip={Boolean(tooltip)}>
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
      {previewUrl ? <img src={previewUrl} className="node-thumb" alt="Target" /> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
