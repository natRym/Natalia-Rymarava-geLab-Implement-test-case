import { expect, test } from "@playwright/test";

import { requireEnvironmentVariable } from "../helpers/environment";
import { captureStepScreenshot } from "../helpers/screenshot";

test.describe("MailLab e2e UI", () => {
  test("sends an attachment from user 1 to user 2 and moves it to trash", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);

    const senderEmail = requireEnvironmentVariable("MAILLAB_USER1_EMAIL");

    const senderPassword = requireEnvironmentVariable("MAILLAB_USER1_PASSWORD");

    const recipientEmail = requireEnvironmentVariable("MAILLAB_USER2_EMAIL");

    const recipientPassword = requireEnvironmentVariable(
      "MAILLAB_USER2_PASSWORD",
    );

    const timestamp = Date.now();

    const subject = `MailLab Playwright ${timestamp}`;

    const attachmentName = `maillab-attachment-${timestamp}.txt`;

    await test.step("Log in as user 1", async () => {
      await page.goto("/login");

      const loginForm = page.locator("form");

      const emailInput = loginForm.locator('input[type="email"]');

      const passwordInput = loginForm.locator('input[type="password"]');

      const signInButton = loginForm.locator('button[type="submit"]');

      await expect(loginForm).toBeVisible();

      await emailInput.fill(senderEmail);

      await passwordInput.fill(senderPassword);

      await expect(signInButton).toBeEnabled();

      await signInButton.click();

      await expect(page.locator('a[href="/inbox"]')).toBeVisible({
        timeout: 30_000,
      });

      await captureStepScreenshot(page, testInfo, "01-user-1-logged-in");
    });

    await test.step("Compose an email to user 2", async () => {
      const newMailButton = page.locator("main button");

      await expect(newMailButton).toBeVisible();

      await newMailButton.click();

      const composeForm = page.locator("form");

      await expect(composeForm).toBeVisible();

      const recipientInput = composeForm.locator(
        'input[type="email"][required]',
      );

      const subjectInput = composeForm.locator('input[placeholder="Subject"]');

      const messageInput = composeForm.locator("textarea[required]");

      const attachmentInput = composeForm.locator('input[type="file"]');

      await recipientInput.fill(recipientEmail);

      await subjectInput.fill(subject);

      await messageInput.fill("MailLab Playwright e2e test.");

      await attachmentInput.setInputFiles({
        name: attachmentName,
        mimeType: "text/plain",
        buffer: Buffer.from("MailLab Playwright e2e attachment."),
      });

      await expect(attachmentInput).toHaveValue(new RegExp(attachmentName));

      await captureStepScreenshot(page, testInfo, "02-email-composed");
    });

    await test.step("Send the email", async () => {
      const composeForm = page.locator("form");

      const sendButton = composeForm.locator('button[type="submit"]');

      /*
       * Send disabled пока загружается
       * attachment.
       */
      await expect(sendButton).toBeEnabled({
        timeout: 60_000,
      });

      await sendButton.click();

      await expect(composeForm).not.toBeVisible({
        timeout: 30_000,
      });

      await captureStepScreenshot(page, testInfo, "03-email-sent");
    });

    await test.step("Verify the email in Sent", async () => {
      await page.locator('a[href="/sent"]').click();

      await expect(page).toHaveURL(/\/sent$/, {
        timeout: 30_000,
      });

      const sentEmailRow = page.locator("table tbody tr").filter({
        hasText: subject,
      });

      await expect(sentEmailRow).toBeVisible({
        timeout: 30_000,
      });

      await expect(sentEmailRow.locator("td:nth-child(1)")).toHaveText(
        recipientEmail,
      );

      /*
       * Ячейка также содержит
       * attachment badge.
       */
      await expect(sentEmailRow.locator("td:nth-child(2)")).toContainText(
        subject,
      );

      await captureStepScreenshot(page, testInfo, "04-email-in-sent");
    });

    await test.step("Log out user 1", async () => {
      const signOutButton = page.locator("aside button");

      await expect(signOutButton).toBeVisible();

      await signOutButton.click();

      await expect(page).toHaveURL(/\/login$/, {
        timeout: 30_000,
      });
    });

    await test.step("Log in as user 2", async () => {
      const loginForm = page.locator("form");

      const emailInput = loginForm.locator('input[type="email"]');

      const passwordInput = loginForm.locator('input[type="password"]');

      const signInButton = loginForm.locator('button[type="submit"]');

      await expect(loginForm).toBeVisible();

      await emailInput.fill(recipientEmail);

      await passwordInput.fill(recipientPassword);

      await expect(signInButton).toBeEnabled();

      await signInButton.click();

      await expect(page.locator('a[href="/inbox"]')).toBeVisible({
        timeout: 30_000,
      });

      await captureStepScreenshot(page, testInfo, "05-user-2-logged-in");
    });

    await test.step("Receive and open the email", async () => {
      await page.locator('a[href="/inbox"]').click();

      await expect(page).toHaveURL(/\/inbox$/, {
        timeout: 30_000,
      });

      const receivedEmailRow = page.locator(
        `xpath=//table//tbody/tr[` +
          `td[2][contains(` +
          `normalize-space(.), ` +
          `"${subject}"` +
          `)]]`,
      );

      await expect(receivedEmailRow).toBeVisible({
        timeout: 60_000,
      });

      await expect(receivedEmailRow.locator("td:nth-child(1)")).toHaveText(
        senderEmail,
      );

      await expect(receivedEmailRow.locator("td:nth-child(2)")).toContainText(
        subject,
      );

      await captureStepScreenshot(page, testInfo, "06-email-received");

      await receivedEmailRow.click();

      await expect(page).toHaveURL(/\/inbox\/.+/, {
        timeout: 30_000,
      });

      const attachmentNameElement = page.locator(
        `xpath=//*[normalize-space()="${attachmentName}"]`,
      );

      await expect(attachmentNameElement).toBeVisible();

      await captureStepScreenshot(page, testInfo, "07-email-opened");
    });

    await test.step("Save the attachment to Disk", async () => {
      const attachmentNameElement = page.locator(
        `xpath=//*[normalize-space()="${attachmentName}"]`,
      );

      await expect(attachmentNameElement).toBeVisible();

      const attachmentSection = attachmentNameElement.locator(
        "xpath=ancestor::div[.//button][1]",
      );

      const saveToDiskButton = attachmentSection.locator(
        "xpath=.//button[" + "normalize-space()=" + '"Save to Disk"' + "]",
      );

      await expect(saveToDiskButton).toBeVisible();

      await saveToDiskButton.click();

      const folderDialog = page.locator(
        "xpath=//div[" +
          'contains(@class,"fixed")' +
          " and " +
          'contains(@class,"inset-0")' +
          "]//div[" +
          ".//h2[" +
          "normalize-space()=" +
          '"Choose a folder"' +
          "]" +
          "]",
      );

      await expect(folderDialog).toBeVisible();

      const inboxAttachmentsButton = folderDialog.locator(
        "xpath=.//button[" + "normalize-space()=" + '"Inbox attachments"' + "]",
      );

      /*
       * Список папок загружается
       * асинхронно.
       */
      await expect(inboxAttachmentsButton).toBeVisible({
        timeout: 30_000,
      });

      await expect(inboxAttachmentsButton).toBeEnabled({
        timeout: 30_000,
      });

      await inboxAttachmentsButton.click();

      await expect(folderDialog).not.toBeVisible({
        timeout: 30_000,
      });

      await page.locator('a[href="/disk"]').click();

      await expect(page).toHaveURL(/\/disk$/, {
        timeout: 30_000,
      });

      const inboxAttachmentsFolder = page.locator(
        "xpath=//span[" +
          "normalize-space()=" +
          '"Inbox attachments"' +
          "]/ancestor::div[" +
          "contains(" +
          '@class,"cursor-pointer"' +
          ")" +
          "][1]",
      );

      await expect(inboxAttachmentsFolder).toBeVisible();

      await inboxAttachmentsFolder.click();

      const savedFileRow = page
        .locator('table tbody tr[draggable="true"]')
        .filter({
          hasText: attachmentName,
        });

      await expect(savedFileRow).toBeVisible({
        timeout: 30_000,
      });

      await expect(savedFileRow.locator("td:first-child")).toHaveText(
        attachmentName,
      );

      await captureStepScreenshot(page, testInfo, "08-file-in-disk");
    });

    await test.step("Move the file to trash using drag and drop", async () => {
      const fileRow = page.locator('table tbody tr[draggable="true"]').filter({
        hasText: attachmentName,
      });

      const trashFolder = page.locator(
        "xpath=//span[" +
          "normalize-space()=" +
          '"Trash"' +
          "]/ancestor::div[" +
          "contains(" +
          '@class,"cursor-pointer"' +
          ")" +
          "][1]",
      );

      await expect(fileRow).toBeVisible();

      await expect(trashFolder).toBeVisible();

      await fileRow.dragTo(trashFolder);

      await expect(fileRow).not.toBeVisible({
        timeout: 30_000,
      });

      await captureStepScreenshot(page, testInfo, "09-file-moved-to-trash");
    });

    await test.step("Verify the file is in trash", async () => {
      const trashFolder = page.locator(
        "xpath=//span[" +
          "normalize-space()=" +
          '"Trash"' +
          "]/ancestor::div[" +
          "contains(" +
          '@class,"cursor-pointer"' +
          ")" +
          "][1]",
      );

      await trashFolder.click();

      const fileInTrashRow = page
        .locator('table tbody tr[draggable="true"]')
        .filter({
          hasText: attachmentName,
        });

      await expect(fileInTrashRow).toBeVisible({
        timeout: 30_000,
      });

      await expect(fileInTrashRow.locator("td:first-child")).toHaveText(
        attachmentName,
      );

      await captureStepScreenshot(page, testInfo, "10-file-in-trash");
    });
  });
});
