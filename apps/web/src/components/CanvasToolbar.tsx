import type { RefObject } from "react";
import type { NodeOption } from "../lib/nodeCatalog";

type CanvasToolbarProps = {
  nodeSearch: string;
  onNodeSearchChange: (value: string) => void;
  quickAddInputRef: RefObject<HTMLInputElement>;
  filteredNodeOptions: NodeOption[];
  onQuickAddFirstNode: () => void;
  onQuickAddNode: (type: string) => void;
  isActionLoading: (actionId: string) => boolean;
  onRecordWeb: () => void;
  onRecordDesktop: () => void;
  desktopRecording: boolean;
  onAutoLayout: () => void;
  onDuplicateSelectedNode: () => void;
  canDuplicateSelectedNode: boolean;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onTestRun: () => void;
  onRun: () => void;
  isDirty: boolean;
  lastAutoSaveAt: string | null;
};

export function CanvasToolbar({
  nodeSearch,
  onNodeSearchChange,
  quickAddInputRef,
  filteredNodeOptions,
  onQuickAddFirstNode,
  onQuickAddNode,
  isActionLoading,
  onRecordWeb,
  onRecordDesktop,
  desktopRecording,
  onAutoLayout,
  onDuplicateSelectedNode,
  canDuplicateSelectedNode,
  snapToGrid,
  onToggleSnap,
  onSaveDraft,
  onPublish,
  onTestRun,
  onRun,
  isDirty,
  lastAutoSaveAt
}: CanvasToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left toolbar-node-add">
        <input
          ref={quickAddInputRef}
          className="toolbar-search"
          value={nodeSearch}
          placeholder="Quick add node (Ctrl/Cmd+K)"
          onChange={(event) => onNodeSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onQuickAddFirstNode();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onNodeSearchChange("");
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
        <button disabled={!filteredNodeOptions.length} onClick={onQuickAddFirstNode}>
          + Add
        </button>
        <div className="toolbar-node-suggestions">
          {filteredNodeOptions.slice(0, 8).map((opt) => (
            <button
              key={opt.type}
              className="toolbar-node-suggestion"
              title={`${opt.category} · ${opt.type}`}
              onClick={() => onQuickAddNode(opt.type)}
            >
              + {opt.label}
            </button>
          ))}
          {!filteredNodeOptions.length ? <small className="toolbar-node-empty">No matching node types</small> : null}
        </div>
      </div>
      <div className="toolbar-right">
        <span className={`draft-state ${isDirty ? "dirty" : "saved"}`} title={lastAutoSaveAt ? `Last autosave: ${lastAutoSaveAt}` : undefined}>
          {isDirty ? "Unsaved changes" : "Saved"}
        </span>
        <button
          disabled={isActionLoading("record-web")}
          className={isActionLoading("record-web") ? "is-loading" : ""}
          onClick={onRecordWeb}
        >
          {isActionLoading("record-web") ? "Starting..." : "Record Web"}
        </button>
        <button
          disabled={isActionLoading("record-desktop")}
          className={isActionLoading("record-desktop") ? "is-loading" : ""}
          onClick={onRecordDesktop}
        >
          {isActionLoading("record-desktop") ? "Working..." : desktopRecording ? "Stop Desktop" : "Record Desktop"}
        </button>
        <details className="toolbar-more">
          <summary>More</summary>
          <div className="toolbar-more-menu">
            <button
              disabled={isActionLoading("auto-layout")}
              className={isActionLoading("auto-layout") ? "is-loading" : ""}
              onClick={onAutoLayout}
            >
              Auto Layout
            </button>
            <button disabled={!canDuplicateSelectedNode} onClick={onDuplicateSelectedNode}>
              Duplicate Node
            </button>
            <button onClick={onToggleSnap}>{snapToGrid ? "Snap: On" : "Snap: Off"}</button>
          </div>
        </details>
        <button
          disabled={isActionLoading("save-draft")}
          className={isActionLoading("save-draft") ? "is-loading" : ""}
          onClick={onSaveDraft}
        >
          {isActionLoading("save-draft") ? "Saving..." : "Save Draft"}
        </button>
        <button
          disabled={isActionLoading("publish")}
          className={isActionLoading("publish") ? "is-loading" : ""}
          onClick={onPublish}
        >
          {isActionLoading("publish") ? "Publishing..." : "Publish"}
        </button>
        <button
          disabled={isActionLoading("test-run")}
          className={isActionLoading("test-run") ? "is-loading" : ""}
          onClick={onTestRun}
        >
          {isActionLoading("test-run") ? "Running..." : "Test Run"}
        </button>
        <button className={`primary ${isActionLoading("run") ? "is-loading" : ""}`} disabled={isActionLoading("run")} onClick={onRun}>
          {isActionLoading("run") ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}
