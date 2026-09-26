import { expect, test } from "@playwright/test";

import { requireEnvironmentVariable } from "../helpers/environment";

test.describe("MailLab e2e UI", () => {
  test("sends an attachment to the same account and moves it to trash", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const email = requireEnvironmentVariable("MAILLAB_EMAIL");

    const password = requireEnvironmentVariable("MAILLAB_PASSWORD");

    const timestamp = Date.now(); //использовать faiker для генерации фиктивных данных

    const subject = `MailLab Playwright ${timestamp}`;

    const attachmentName = `maillab-attachment-${timestamp}.txt`;

    await test.step("Log in", async () => {
      await page.goto("/login");

      const loginForm = page.locator("form");

      const emailInput = loginForm.locator('input[type="email"]'); // использовать playwright inspector, разобраться с локаторами playwright (использовать толькоо их)

      const passwordInput = loginForm.locator('input[type="password"]');

      const signInButton = loginForm.locator('button[type="submit"]');

      await expect(loginForm).toBeVisible(); // все expect должны содержать error message

      await emailInput.fill(email);

      await passwordInput.fill(password);

      await expect(signInButton).toBeEnabled();

      await signInButton.click();

      await expect(page.locator('a[href="/inbox"]')).toBeVisible({
        timeout: 30_000,
      }); // разобраться с таймаутами Playwright + строка 39
    });

    await test.step("Compose an email to the same account", async () => {
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

      await recipientInput.fill(email);

      await subjectInput.fill(subject);

      await messageInput.fill("MailLab Playwright e2e test.");

      await attachmentInput.setInputFiles({
        name: attachmentName,
        mimeType: "text/plain",
        buffer: Buffer.from("MailLab Playwright e2e attachment."),
      });

      await expect(attachmentInput).toHaveValue(new RegExp(attachmentName));
    });

    await test.step("Send the email", async () => {
      const composeForm = page.locator("form");

      const sendButton = composeForm.locator('button[type="submit"]');

      await expect(sendButton).toBeEnabled({
        timeout: 60_000,
      });

      await sendButton.click();

      await expect(composeForm).not.toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("Verify the email in Sent", async () => {
      await page.locator('a[href="/sent"]').click();

      await expect(page).toHaveURL(/\/sent$/, {
        timeout: 30_000,
      }); // привести тест согласно user bahaviour

      const sentEmailRow = page.locator("table tbody tr").filter({
        hasText: subject,
      });

      await expect(sentEmailRow).toBeVisible({
        timeout: 30_000,
      });

      await expect(sentEmailRow.locator("td:nth-child(1)")).toHaveText(email);

      await expect(sentEmailRow.locator("td:nth-child(2)")).toContainText(
        subject,
      );
    });

    await test.step("Receive and open the email", async () => {
      const loadingIndicator = page.locator(
        'xpath=//*[normalize-space()="Loading..."]',
      );

      await expect
        .poll(
          async () => {
            await page.goto("/inbox");

            await expect(loadingIndicator).toBeHidden({
              timeout: 15_000,
            });

            const subjects = await page
              .locator("table tbody tr td:nth-child(2)")
              .allTextContents();

            return subjects.some((text) => text.includes(subject));
          },
          {
            message: `Waiting for email: ${subject}`,
            timeout: 90_000,
            intervals: [1_000, 2_000, 5_000],
          }, // 135 - 165 разобраться (сколько будеет работать таймаут, сколько попыток через какое время)
        )
        .toBe(true);

      const receivedSubject = page
        .locator("table tbody tr td:nth-child(2)")
        .filter({
          hasText: subject,
        });

      await expect(receivedSubject).toBeVisible();

      await expect(receivedSubject).toContainText(subject);

      const receivedEmailRow = receivedSubject.locator("xpath=parent::tr");

      await expect(receivedEmailRow.locator("td:nth-child(1)")).toHaveText(
        email,
      );

      await receivedEmailRow.click();

      await expect(page).toHaveURL(/\/inbox\/.+/, {
        timeout: 30_000, //синтаксис регулярных выражений
      });

      const attachmentNameElement = page.locator(
        `xpath=//*[normalize-space()="${attachmentName}"]`,
      );

      await expect(attachmentNameElement).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("Save the attachment to Disk", async () => {
      const saveToDiskButton = page.locator(
        "xpath=//button[" + 'normalize-space()="Save to Disk"' + "]",
      );

      await expect(saveToDiskButton).toBeVisible();

      await saveToDiskButton.click();

      const folderDialog = page.locator(
        "xpath=//div[" +
          'contains(@class,"fixed")' +
          " and " +
          'contains(@class,"inset-0")' +
          "]",
      );

      await expect(folderDialog).toBeVisible();

      const inboxAttachmentsButton = folderDialog.locator(
        "xpath=.//button[" + 'normalize-space()="Inbox attachments"' + "]",
      );

      await expect(inboxAttachmentsButton).toBeVisible({
        timeout: 30_000,
      });

      await expect(inboxAttachmentsButton).toBeEnabled();

      await inboxAttachmentsButton.click();

      await expect(folderDialog).not.toBeVisible({
        timeout: 30_000,
      });

      await page.goto("/disk");

      await expect(page).toHaveURL(/\/disk$/);

      const diskLoadingIndicator = page.locator(
        'xpath=//*[normalize-space()="Loading..."]',
      );

      await expect(diskLoadingIndicator).toBeHidden({
        timeout: 30_000,
      });

      const inboxAttachmentsFolder = page.locator(
        "xpath=//span[" +
          'normalize-space()="Inbox attachments"' +
          "]/ancestor::div[" +
          'contains(@class,"cursor-pointer")' +
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
    });
  });
});
