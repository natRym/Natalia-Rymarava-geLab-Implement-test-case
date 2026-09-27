import { expect, test } from "@playwright/test";
import { faker } from "@faker-js/faker";

import { requireEnvironmentVariable } from "../helpers/environment";

test.describe("MailLab e2e UI", () => {
  test("sends an attachment to the same account and moves it to trash", async ({
    page,
  }) => {
    test.setTimeout(180_000); // максимальное время выполнения всего теста, 3 минуты

    const email = requireEnvironmentVariable("MAILLAB_EMAIL"); //берем адрес почты из переменной и используем его для входа и отправки письма
    const password = requireEnvironmentVariable("MAILLAB_PASSWORD");

    const uniqueId = faker.string.uuid();
    const subject = `MailLab Playwright ${uniqueId}`;
    const attachmentName = `maillab-attachment-${uniqueId}.txt`;

    await test.step("Log in", async () => {
      await page.goto("/login");

      const loginForm = page.locator("form");
      await expect(loginForm, "Login form should be visible").toBeVisible();

      await loginForm
        .getByRole("textbox", { name: "you@maillab.local" })
        .fill(email);

      await loginForm.locator('input[type="password"]').fill(password);

      await loginForm.getByRole("button", { name: "Sign in" }).click();

      await expect(
        page.getByRole("link", { name: "Inbox" }),
        "After login, the Inbox link should be visible",
      ).toBeVisible({ timeout: 10_000 }); // Ждем, пока ссылка "Inbox" станет видимой после входа,
    });

    await test.step("Compose an email to the same account", async () => {
      await page.getByRole("button", { name: "+ New mail" }).click();

      const recipientInput = page.getByPlaceholder("recipient@maillab.local");
      const subjectInput = page.getByRole("textbox", {
        name: "Subject",
      });
      const messageInput = page.getByRole("textbox", {
        name: "Write your message...",
      });
      const attachmentInput = page.locator('input[type="file"]');

      await expect(
        recipientInput,
        "Recipient input should be visible",
      ).toBeVisible();
      await recipientInput.fill(email);
      await subjectInput.fill(subject);
      await messageInput.fill("MailLab Playwright e2e test.");

      await attachmentInput.setInputFiles({
        name: attachmentName,
        mimeType: "text/plain",
        buffer: Buffer.from("MailLab Playwright e2e attachment."),
      });

      await expect(
        attachmentInput,
        "Attachment input should have the correct value",
      ).toHaveValue(new RegExp(attachmentName.replaceAll(".", "\\.")));
    });

    await test.step("Send the email", async () => {
      const sendButton = page.getByRole("button", {
        name: "Send",
        exact: true,
      });

      await expect(sendButton, "Send button should be enabled").toBeEnabled();
      await sendButton.click();
      await expect(
        sendButton,
        "Send button should be hidden after clicking",
      ).toBeHidden();
    });

    await test.step("Verify the email in Sent", async () => {
      await page.getByRole("link", { name: "Sent" }).click();

      const sentEmailRow = page
        .getByRole("table")
        .getByRole("row")
        .filter({ hasText: subject });

      await expect(
        sentEmailRow,
        `The email with subject ${subject} should be visible in Sent`,
      ).toBeVisible();

      await expect(
        sentEmailRow.getByRole("cell").first(),
        "Sent email row first cell should have the correct email",
      ).toHaveText(email);

      await expect(
        sentEmailRow.getByRole("cell").nth(1),
        "Sent email row second cell should contain the correct subject",
      ).toContainText(subject);
    });

    await test.step("Receive and open the email", async () => {
      await expect
        .poll(
          async () => {
            await page.goto("/inbox");
            await expect(page.getByRole("table")).toBeVisible();

            const matchingEmailRow = page
              .getByRole("table")
              .getByRole("row")
              .filter({ hasText: subject });

            return matchingEmailRow.count();
          },
          {
            message: `Waiting for email: ${subject}`,
            timeout: 90_000, //Максимальное время ожидания письма в папке "Inbox"
            intervals: [1_000, 2_000, 5_000], //Интервалы опроса для проверки появления письма; Первоначальная проверка через 1 секунду, затем через 2 секунды, затем через 5 секундю и так далее до достижения таймаута. Внутри каждой попытки выполняется переход в Inbox и проверка наличия письма в папке "Inbox"
          },
        )
        .toBeGreaterThan(0);

      const receivedEmailRow = page
        .getByRole("table")
        .getByRole("row")
        .filter({ hasText: subject });

      await expect(
        receivedEmailRow,
        "Received email row should be visible",
      ).toBeVisible();

      await expect(
        receivedEmailRow.getByRole("cell").first(),
        "Received email row first cell should have the correct email",
      ).toHaveText(email);

      await receivedEmailRow.click();

      await expect(
        page.getByRole("heading", { name: subject, exact: true }),
        "After opening the email, the subject heading should be visible",
      ).toBeVisible();

      await expect(
        page.getByText(attachmentName, { exact: true }),
        `The attachment should be visible in the opened email: ${attachmentName}`,
      ).toBeVisible();
    });

    await test.step("Save the attachment to Disk", async () => {
      await page.getByRole("button", { name: "Save to Disk" }).click();

      const folderDialog = page.locator("div.fixed.inset-0");
      await expect(folderDialog).toBeVisible();

      await folderDialog
        .getByRole("button", { name: "Inbox attachments" })
        .click();

      await expect(
        folderDialog,
        "Folder dialog should be hidden after saving the attachment",
      ).toBeHidden();

      await expect(
        page.getByText(`Saved as "${attachmentName}" to Disk.`, {
          exact: true,
        }),
        `The attachment should be saved with the name ${attachmentName}`,
      ).toBeVisible();

      await page.getByRole("link", { name: "Disk" }).click();

      await page.getByText("Inbox attachments", { exact: true }).click();

      const savedFileRow = page
        .getByRole("table")
        .getByRole("row")
        .filter({ hasText: attachmentName });

      await expect(
        savedFileRow.getByRole("cell").first(),
        "Saved file row first cell should have the correct attachment name",
      ).toHaveText(attachmentName);
    });

    await test.step("Move the file to trash using drag and drop", async () => {
      const fileRow = page
        .getByRole("table")
        .getByRole("row")
        .filter({ hasText: attachmentName });

      const trashFolder = page
        .getByText("Trash", { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "cursor-pointer")][1]');

      await expect(
        fileRow,
        `The file ${attachmentName} should be visible in Inbox attachments before moving to trash`,
      ).toBeVisible();
      await expect(
        trashFolder,
        "The trash folder should be visible before moving the file to trash",
      ).toBeVisible();

      await fileRow.dragTo(trashFolder);

      await expect(
        page.getByText("Moved to Trash.", { exact: true }),
        "After moving the file to trash, a confirmation message should be visible",
      ).toBeVisible();

      await expect(
        fileRow,
        `The file ${attachmentName} should disappear from Inbox attachments`,
      ).toBeHidden();
    });
    await test.step("Verify the file is in trash", async () => {
      const trashFolder = page
        .getByText("Trash", { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "cursor-pointer")][1]');

      await trashFolder.click();

      const fileInTrashRow = page
        .getByRole("table")
        .getByRole("row")
        .filter({ hasText: attachmentName });

      await expect(
        fileInTrashRow.getByRole("cell").first(),
        "File in trash row first cell should have the correct attachment name",
      ).toHaveText(attachmentName);
    });
  });
});
