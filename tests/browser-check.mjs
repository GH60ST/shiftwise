import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("work", { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(7000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page
  .getByRole("heading", { name: "A better week starts here." })
  .waitFor();
await page.screenshot({ path: "work/desktop.png", fullPage: true });
await page.getByRole("button", { name: "Add shift", exact: true }).click();
await page.locator('[name="start"]').fill("10:00");
await page.locator('[name="end"]').fill("12:00");
await page.getByRole("button", { name: "Save changes" }).click();
await page.locator(".shift.conflict").first().waitFor();
assert.equal(await page.locator(".shift.conflict").count(), 2);
await page.reload();
assert.equal(await page.locator(".shift.conflict").count(), 2);
await page.locator(".shift.conflict").filter({ hasText: "10:00" }).click();
await page.locator('[name="end"]').fill("09:00");
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByRole("alert").waitFor();
await page.locator('[name="start"]').fill("17:00");
await page.locator('[name="end"]').fill("18:00");
await page.getByRole("button", { name: "Save changes" }).click();
assert.equal(await page.locator(".shift.conflict").count(), 0);
await page.getByRole("button", { name: "Employees", exact: true }).click();
await page.getByRole("button", { name: "Add employee", exact: true }).click();
await page.locator('[name="name"]').fill("Quinn Demo");
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByRole("heading", { name: "Quinn Demo" }).waitFor();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("button", { name: "Edit preferences" }).click();
await page.locator('[name="budget"]').fill("100");
await page.getByRole("button", { name: "Save changes" }).click();
assert.match(await page.locator(".metrics").innerText(), /over/);
await page.getByRole("button", { name: "Roster", exact: true }).click();
const download = page.waitForEvent("download");
await page.getByRole("button", { name: "Export CSV" }).click();
assert.equal((await download).suggestedFilename(), "shiftwise-2026-11-02.csv");
page.on("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Reset Demo Data" }).click();
assert.equal(await page.locator("tbody tr").count(), 6);
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
await mobile.goto("http://localhost:5173");
await mobile
  .getByRole("heading", { name: "A better week starts here." })
  .waitFor();
assert.equal(
  await mobile.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  ),
  true,
);
await mobile.getByRole("button", { name: "Add shift", exact: true }).click();
assert.equal(await mobile.locator("dialog").isVisible(), true);
await mobile.getByRole("button", { name: "Cancel", exact: true }).click();
await mobile.screenshot({ path: "work/iphone.png", fullPage: true });
assert.deepEqual(errors, []);
console.log(
  "Browser checks passed: create/edit conflict, validation, persistence, employees, settings, export, reset, desktop and iPhone viewport.",
);
await browser.close();
