import { useEffect, useState } from "react";
import type { Node } from "reactflow";
import { API_URL } from "../api";
import { imagePathToUrl } from "../utils";

export function Inspector({ node, onUpdate }: { node: Node | null; onUpdate: any }) {
  const [json, setJson] = useState("");

  useEffect(() => {
    if (!node) {
      setJson("");
      return;
    }
    setJson(JSON.stringify(node.data, null, 2));
  }, [node]);

  if (!node) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>Select a node to edit its settings.</p>
      </aside>
    );
  }

  const previewUrl =
    node.data?.type === "desktop_click_image" ? imagePathToUrl(API_URL, node.data?.imagePath) : null;

  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      <div className="inspector-body">
        <label>Node ID</label>
        <div className="readonly">{node.id}</div>
        {previewUrl ? (
          <>
            <label>Target Preview</label>
            <img className="inspector-thumb" src={previewUrl} alt="Target preview" />
          </>
        ) : null}
        <label>Data</label>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          rows={16}
        />
        <button
          onClick={() => {
            try {
              const next = JSON.parse(json);
              onUpdate((nodes: Node[]) =>
                nodes.map((n) => (n.id === node.id ? { ...n, data: next } : n))
              );
            } catch {
              alert("Invalid JSON");
            }
          }}
        >
          Apply
        </button>
      </div>
    </aside>
  );
}
