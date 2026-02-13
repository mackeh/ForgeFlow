import { useEffect } from "react";

type UseGlobalHotkeysParams = {
  enabled: boolean;
  onSave: () => void;
  onRun: () => void;
  onTestRun: () => void;
  onFocusQuickAdd: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAutoLayout: () => void;
};

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(element.isContentEditable)
  );
}

export function useGlobalHotkeys({
  enabled,
  onSave,
  onRun,
  onTestRun,
  onFocusQuickAdd,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onAutoLayout
}: UseGlobalHotkeysParams) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const hasCmd = event.ctrlKey || event.metaKey;

      if (hasCmd && key === "s") {
        event.preventDefault();
        onSave();
        return;
      }
      if (hasCmd && key === "r") {
        event.preventDefault();
        onRun();
        return;
      }
      if (hasCmd && key === "t") {
        event.preventDefault();
        onTestRun();
        return;
      }
      if (hasCmd && key === "k") {
        event.preventDefault();
        onFocusQuickAdd();
        return;
      }
      if (hasCmd && key === "z" && event.shiftKey) {
        event.preventDefault();
        onRedo();
        return;
      }
      if (hasCmd && key === "z") {
        event.preventDefault();
        onUndo();
        return;
      }
      if (hasCmd && key === "y") {
        event.preventDefault();
        onRedo();
        return;
      }
      if (hasCmd && key === "d") {
        event.preventDefault();
        onDuplicate();
        return;
      }
      if (!hasCmd && (key === "delete" || key === "backspace")) {
        event.preventDefault();
        onDelete();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        onAutoLayout();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, onSave, onRun, onTestRun, onFocusQuickAdd, onUndo, onRedo, onDuplicate, onDelete, onAutoLayout]);
}
