import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { CanvasToolbar } from "./CanvasToolbar";

test("quick-add input Enter triggers add-first action", () => {
  const onQuickAddFirstNode = vi.fn();
  render(
    <CanvasToolbar
      nodeSearch=""
      onNodeSearchChange={() => undefined}
      quickAddInputRef={createRef<HTMLInputElement>()}
      filteredNodeOptions={[{ label: "HTTP Request", type: "http_request", category: "Core" }]}
      onQuickAddFirstNode={onQuickAddFirstNode}
      onQuickAddNode={() => undefined}
      isActionLoading={() => false}
      onRecordWeb={() => undefined}
      onRecordDesktop={() => undefined}
      desktopRecording={false}
      onAutoLayout={() => undefined}
      onDuplicateSelectedNode={() => undefined}
      canDuplicateSelectedNode={false}
      snapToGrid={true}
      onToggleSnap={() => undefined}
      onSaveDraft={() => undefined}
      onPublish={() => undefined}
      onTestRun={() => undefined}
      onRun={() => undefined}
      isDirty={false}
      lastAutoSaveAt={null}
    />
  );
  fireEvent.keyDown(screen.getByPlaceholderText("Quick add node (Ctrl/Cmd+K)"), { key: "Enter" });
  expect(onQuickAddFirstNode).toHaveBeenCalledTimes(1);
});

test("toolbar shows dirty draft status", () => {
  render(
    <CanvasToolbar
      nodeSearch=""
      onNodeSearchChange={() => undefined}
      quickAddInputRef={createRef<HTMLInputElement>()}
      filteredNodeOptions={[{ label: "HTTP Request", type: "http_request", category: "Core" }]}
      onQuickAddFirstNode={() => undefined}
      onQuickAddNode={() => undefined}
      isActionLoading={() => false}
      onRecordWeb={() => undefined}
      onRecordDesktop={() => undefined}
      desktopRecording={false}
      onAutoLayout={() => undefined}
      onDuplicateSelectedNode={() => undefined}
      canDuplicateSelectedNode={false}
      snapToGrid={true}
      onToggleSnap={() => undefined}
      onSaveDraft={() => undefined}
      onPublish={() => undefined}
      onTestRun={() => undefined}
      onRun={() => undefined}
      isDirty={true}
      lastAutoSaveAt="10:30:00"
    />
  );
  expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
});
