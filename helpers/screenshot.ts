import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

export async function captureStepScreenshot(
  page: Page,
  testInfo: TestInfo,
  stepName: string,
): Promise<void> {
  const safeName = stepName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const screenshotDirectory =
    testInfo.outputPath("screenshots");

  const screenshotPath = path.join(
    screenshotDirectory,
    `${safeName}.png`,
  );

  await mkdir(screenshotDirectory, {
    recursive: true,
  });

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  await testInfo.attach(stepName, {
    path: screenshotPath,
    contentType: "image/png",
  });
}