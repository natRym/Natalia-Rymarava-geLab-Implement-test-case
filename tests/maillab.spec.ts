import { expect, test } from "@playwright/test";
import { faker } from "@faker-js/faker";
import { copyFile } from "node:fs/promises";
import path from "node:path";

import { requireEnvironmentVariable } from "../helpers/environment";

test("sends an attachment to the same account and moves it to trash", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000); // максимальное время выполнения всего теста, 3 минуты

  const email = requireEnvironmentVariable("MAILLAB_EMAIL"); //берем адрес почты из переменной и используем его для входа и отправки письма
  const password = requireEnvironmentVariable("MAILLAB_PASSWORD");

  const numericId = faker.string.numeric(5);
  const subject = `MailLab Playwright ${numericId}`;
  const attachmentName = `maillab-attachment-${numericId}.txt`;

  const attachmentPath = testInfo.outputPath(attachmentName);

  await copyFile(
    path.resolve("test-data", "maillab-attachment.txt"),
    attachmentPath,
  );

  await test.step("Log in", async () => {
    await page.goto("/login");

    const loginForm = page.locator("form");
    await expect(loginForm, "Login form should be visible").toBeVisible();

    await loginForm
      .getByRole("textbox", { name: "you@maillab.local" })
      .fill(email);

    await loginForm.locator('input[type="password"]').fill(password);

    await loginForm.getByRole("button", { name: "Sign in" }).click();

    const inboxHeading = page.getByRole("heading", {
      name: "Inbox",
      // exact: true, // можно обойтись без него, тк у меня только 1 заголовок с таким именем. Но лучше оставить, тк Inbox не дополняется текстом (например: 7)
    });

    await expect(
      inboxHeading,
      "After login, the Inbox page should be displayed",
    ).toBeVisible();

    await test.step("Compose a new email to the same account", async () => {
      await page.getByRole("button", { name: "+ New mail" }).click();

      const recipientInput = page.getByPlaceholder("recipient@maillab.local");
      const subjectInput = page.getByRole("textbox", {
        name: "Subject",
      });
      const messageInput = page.getByRole("textbox", {
        name: "Write your message...",
      });
      const attachmentInput = page.locator('input[type="file"]');

      await recipientInput.fill(email);
      await subjectInput.fill(subject);
      await messageInput.fill("MailLab Playwright e2e test.");

      await attachmentInput.setInputFiles(attachmentPath);
    });

    await test.step("Send the email", async () => {
      const sendButton = page.getByRole("button", {
        name: "Send",
      });

      await expect(sendButton, "Send button should be enabled").toBeEnabled();
      await sendButton.click(); // ! https://playwright.dev/docs/actionability

      await expect(
        page.getByText("Message sent."),
        "Success message should be displayed after sending",
      ).toBeVisible();
    });

    await test.step("Verify the email in Sent folder", async () => {
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
        //ожидаем, что строка с полученным письмом будет видимой
        receivedEmailRow,
        "Received email row should be visible",
      ).toBeVisible(); // !https://playwright.dev/docs/actionability (пос)

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

      await page.getByRole("button", { name: "Inbox attachments" }).click();

      await expect(
        page.getByText(`Saved as "${attachmentName}" to Disk.`, {
          exact: true,
        }),
        `The attachment should be saved with the name ${attachmentName}`,
      ).toBeVisible();

      await page.getByRole("link", { name: "Disk" }).click();

      await page.getByText("Inbox attachments").click();

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
        .getByText("FOLDERS")
        .locator("..")
        .getByText("Trash")
        .locator("..");

      await fileRow.dragTo(trashFolder);

      await expect(
        page.getByText("Moved to Trash."),
        "After moving the file to trash, a confirmation message should be visible",
      ).toBeVisible();

      await expect(
        fileRow,
        `The file ${attachmentName} should disappear from Inbox attachments`,
      ).toBeHidden();
    });
    await test.step("Verify the file is in trash", async () => {
      const trashFolder = page
        .getByText("FOLDERS")
        .locator("..")
        .getByText("Trash")
        .locator("..");

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
