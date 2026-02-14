export type StarterWalkthroughStep = {
  id: string;
  sectionId: string;
  title: string;
  description: string;
};

export const STARTER_WALKTHROUGH_STEPS: StarterWalkthroughStep[] = [
  {
    id: "template",
    sectionId: "templates",
    title: "Pick a Starter Template",
    description: "Choose a production starter, review setup requirements, and name your workflow."
  },
  {
    id: "setup",
    sectionId: "templates",
    title: "Complete Template Setup",
    description: "Fill required setup fields, confirm integrations, and run template preflight validation."
  },
  {
    id: "integrations",
    sectionId: "integrations",
    title: "Verify Integrations",
    description: "Create or test required integration profiles before your first run."
  },
  {
    id: "run",
    sectionId: "workflow",
    title: "Run in Test Mode",
    description: "Start a test run and inspect diagnostics and context outputs."
  },
  {
    id: "publish",
    sectionId: "versions",
    title: "Publish and Schedule",
    description: "Publish after a green test run, then attach schedule/orchestrator settings."
  }
];

export function clampWalkthroughIndex(index: number) {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(STARTER_WALKTHROUGH_STEPS.length - 1, Math.floor(index)));
}
