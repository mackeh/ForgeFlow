import { expect, test, type Page } from "@playwright/test";
import { installMockApi } from "./mockApi";

async function signIn(page: Page) {
  await installMockApi(page);
  await page.goto("/");
  await page.getByPlaceholder("Username").fill("local");
  await page.getByPlaceholder("Password").fill("localpass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/User:\s*local/i)).toBeVisible();
}

test("login smoke", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("button", { name: "Test Run" })).toBeVisible();
  await expect(page.getByText("Automations")).toBeVisible();
});

test("workflow create and test run smoke", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: "New" }).click();
  await expect(page.locator(".status-bar")).toContainText("Workflow created");

  await page.getByRole("button", { name: "Test Run" }).click();
  await expect(page.locator(".status-bar")).toContainText("Test run started");
  await expect(page.locator(".run-list .run-item").first()).toContainText("SUCCEEDED");
});

test("orchestrator queue and dispatch smoke", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: "Orchestrator" }).click();
  await page.getByRole("button", { name: "Create Robot" }).click();
  await expect(page.locator(".status-bar")).toContainText("Robot created");

  await page.getByRole("button", { name: "Queue Job" }).click();
  await expect(page.locator(".status-bar")).toContainText("Orchestrator job queued");
  await expect(page.getByText("QUEUED").first()).toBeVisible();

  await page.getByRole("button", { name: "Dispatch" }).first().click();
  await expect(page.locator(".status-bar")).toContainText("Job dispatched");

  await page.getByRole("button", { name: "Sync" }).first().click();
  await expect(page.getByText("COMPLETED").first()).toBeVisible();
});

test("mining panel loads smoke", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: "Mining" }).click();
  await page.getByRole("button", { name: "Refresh Mining" }).click();

  await expect(page.getByRole("heading", { name: "Process Mining" })).toBeVisible();
  await expect(page.getByText(/Runs:\s*\d+\s*·\s*Failed:/)).toBeVisible();
  await expect(page.getByText("Demo Workflow").first()).toBeVisible();
});
