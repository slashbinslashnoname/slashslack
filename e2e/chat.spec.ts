import { test, expect } from "@playwright/test";

// Unique email per run so the suite is repeatable against a persistent DB.
const stamp = Date.now();

test("register, land in workspace, post a message", async ({ page }) => {
  await page.goto("/");

  // switch to the sign-up form
  await page.getByText("Don't have an account? Sign up").click();
  await page.getByPlaceholder("Display name").fill("E2E User");
  await page.getByPlaceholder("Email").fill(`e2e+${stamp}@example.com`);
  await page.getByPlaceholder("Password").fill("supersecret");
  await page.getByRole("button", { name: "Create account" }).click();

  // sidebar shows the seeded #general channel
  await expect(page.getByText("general")).toBeVisible();

  // post a message and see it appear
  const text = `hello from e2e ${stamp}`;
  const composer = page.getByPlaceholder(/Message #/);
  await composer.fill(text);
  await composer.press("Enter");
  await expect(page.getByText(text)).toBeVisible();
});

test("realtime: a second user sees the first user's message live", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();

  for (const [page, name] of [
    [pageA, "Alice"],
    [pageB, "Bob"],
  ] as const) {
    await page.goto("/");
    await page.getByText("Don't have an account? Sign up").click();
    await page.getByPlaceholder("Display name").fill(name);
    await page.getByPlaceholder("Email").fill(`${name.toLowerCase()}+${stamp}@example.com`);
    await page.getByPlaceholder("Password").fill("supersecret");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("general")).toBeVisible();
  }

  const msg = `realtime ${stamp}`;
  const composerA = pageA.getByPlaceholder(/Message #/);
  await composerA.fill(msg);
  await composerA.press("Enter");

  // Bob should receive it over the websocket without reloading
  await expect(pageB.getByText(msg)).toBeVisible({ timeout: 10_000 });
});
