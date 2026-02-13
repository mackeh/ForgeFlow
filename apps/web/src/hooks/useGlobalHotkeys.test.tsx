import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useGlobalHotkeys } from "./useGlobalHotkeys";

type HarnessProps = {
  onSave?: () => void;
  onRun?: () => void;
  onTestRun?: () => void;
  onFocusQuickAdd?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onAutoLayout?: () => void;
};

function Harness({
  onSave = () => undefined,
  onRun = () => undefined,
  onTestRun = () => undefined,
  onFocusQuickAdd = () => undefined,
  onDuplicate = () => undefined,
  onDelete = () => undefined,
  onAutoLayout = () => undefined
}: HarnessProps) {
  const quickRef = useRef<HTMLInputElement>(null);

  useGlobalHotkeys({
    enabled: true,
    onSave,
    onRun,
    onTestRun,
    onFocusQuickAdd: () => {
      quickRef.current?.focus();
      onFocusQuickAdd();
    },
    onDuplicate,
    onDelete,
    onAutoLayout
  });

  return (
    <div>
      <input data-testid="quick-add" ref={quickRef} />
      <input data-testid="editable-input" />
    </div>
  );
}

test("Ctrl/Cmd+K focuses quick-add input", () => {
  const onFocusQuickAdd = vi.fn();
  render(<Harness onFocusQuickAdd={onFocusQuickAdd} />);
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(onFocusQuickAdd).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("quick-add")).toHaveFocus();
});

test("Ctrl+D triggers duplicate action", () => {
  const onDuplicate = vi.fn();
  render(<Harness onDuplicate={onDuplicate} />);
  fireEvent.keyDown(window, { key: "d", ctrlKey: true });
  expect(onDuplicate).toHaveBeenCalledTimes(1);
});

test("Delete triggers delete action", () => {
  const onDelete = vi.fn();
  render(<Harness onDelete={onDelete} />);
  fireEvent.keyDown(window, { key: "Delete" });
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test("shortcuts are ignored when focused inside editable elements", () => {
  const onSave = vi.fn();
  render(<Harness onSave={onSave} />);
  const editable = screen.getByTestId("editable-input");
  editable.focus();
  fireEvent.keyDown(editable, { key: "s", ctrlKey: true });
  expect(onSave).not.toHaveBeenCalled();
});
