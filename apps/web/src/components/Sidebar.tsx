import { useState, type ReactNode } from "react";
import type { WorkflowSummary } from "../types";

type SidebarProps = {
  workflows: WorkflowSummary[];
  activeId?: string | null;
  onSelect: (workflow: WorkflowSummary) => void;
  onCreate: () => void;
  children?: ReactNode;
};

export function Sidebar({ workflows, activeId, onSelect, onCreate, children }: SidebarProps) {
  const [filter, setFilter] = useState("");
  const filtered = workflows.filter((w) => w.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Automations</h2>
        <button onClick={onCreate}>New</button>
      </div>
      <input
        className="search"
        placeholder="Search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="workflow-list">
        {filtered.map((wf) => (
          <button
            key={wf.id}
            className={wf.id === activeId ? "workflow-item active" : "workflow-item"}
            onClick={() => onSelect(wf)}
          >
            <span>{wf.name}</span>
            <small>{new Date(wf.updatedAt).toLocaleString()}</small>
          </button>
        ))}
      </div>
      {children ? <div className="sidebar-extra">{children}</div> : null}
    </aside>
  );
}
