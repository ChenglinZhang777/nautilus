/**
 * fetchers/openai.ts
 *
 * 自动从 OpenAI Platform 创建 API Key 并返回。
 *
 * 流程：
 * 1. 持久化 session 打开浏览器
 * 2. 导航到 /api-keys
 * 3. 点击 "Create new secret key" → 填写名称 → 复制 key
 * 4. 写回 Obsidian + .env
 */

import { Page } from "playwright";
import {
  FetchResult,
  FetcherOptions,
  launchContext,
  waitForLogin,
  waitForUserAction,
  writeToObsidian,
  writeToEnvFile,
} from "./_base";
import * as path from "path";

const SERVICE = "openai";
const LOGIN_URL = "https://platform.openai.com/login";
const KEYS_URL = "https://platform.openai.com/api-keys";
const LOGGED_IN_PATTERN = /platform\.openai\.com\/(api-keys|playground|assistants|usage)/;

async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto(KEYS_URL, { waitUntil: "domcontentloaded" });
  // 未登录会被重定向到 /auth/login
  return !page.url().includes("/login") && !page.url().includes("/auth");
}

async function createKey(page: Page, keyName: string): Promise<string> {
  await page.goto(KEYS_URL, { waitUntil: "networkidle" });

  // 点击创建按钮
  const createBtn = page.locator(
    'button:has-text("Create new secret key"), button:has-text("Create secret key"), button:has-text("+ Create")'
  ).first();
  await createBtn.waitFor({ timeout: 10_000 });
  await createBtn.click();

  // 填写 key 名称（对话框中的输入框）
  const nameInput = page.locator(
    'dialog input[type="text"], [role="dialog"] input[type="text"]'
  ).first();
  await nameInput.waitFor({ timeout: 5_000 });
  await nameInput.fill(keyName);

  // 点击确认
  const confirmBtn = page.locator(
    'dialog button:has-text("Create secret key"), [role="dialog"] button:has-text("Create")'
  ).last();
  await confirmBtn.click();

  // 等待 key 出现（格式 sk-proj- 或 sk-）
  console.log("   等待 API Key 生成...");
  await waitForUserAction(
    page,
    "等待 API Key 显示...",
    '[data-testid="secret-key-value"], input[value^="sk-"], code:has-text("sk-")',
    30_000
  );

  // 读取 key 值
  const fromInput = await page
    .locator('input[value^="sk-"]')
    .first()
    .inputValue()
    .catch(() => "");
  if (fromInput) return fromInput;

  const fromCode = await page
    .locator('code:has-text("sk-"), [data-testid="secret-key-value"]')
    .first()
    .innerText()
    .catch(() => "");
  const match = fromCode.match(/sk-\S+/);
  if (match) return match[0];

  throw new Error("无法自动读取生成的 API Key，请手动复制后填写 Obsidian。");
}

async function fetchOrgId(page: Page): Promise<string | null> {
  try {
    // 组织 ID 通常在 Settings 页面
    await page.goto("https://platform.openai.com/settings/organization/general", {
      waitUntil: "networkidle",
    });
    const orgText = await page
      .locator('[data-testid="org-id"], code:has-text("org-")')
      .first()
      .innerText()
      .catch(() => "");
    const match = orgText.match(/org-\S+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export async function fetchOpenAIKey(
  opts: FetcherOptions = {}
): Promise<FetchResult> {
  const keyName = `${opts.keyNamePrefix ?? "bmad"}-${Date.now()}`;
  const context = await launchContext(SERVICE);

  try {
    const page = await context.newPage();

    if (!(await isLoggedIn(page))) {
      await waitForLogin(page, LOGIN_URL, LOGGED_IN_PATTERN);
      await page.goto(KEYS_URL, { waitUntil: "networkidle" });
    }

    console.log("   正在 OpenAI Platform 创建 API Key...");
    const apiKey = await createKey(page, keyName);

    const envVars: Record<string, string> = { OPENAI_API_KEY: apiKey };

    // 顺带获取 Org ID（可选，失败不阻断）
    const orgId = await fetchOrgId(page);
    if (orgId) envVars["OPENAI_ORG_ID"] = orgId;

    return { success: true, envVars };
  } catch (err) {
    return { success: false, envVars: {}, error: (err as Error).message };
  } finally {
    await context.close();
  }
}

// ─── 独立运行入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const envFilePath = process.argv[2] ?? path.join(process.cwd(), ".env");

  console.log(`\n🔑 OpenAI API Key 自动获取`);

  fetchOpenAIKey().then((result) => {
    if (!result.success) {
      console.error(`\n❌ 失败: ${result.error}`);
      process.exit(1);
    }
    writeToObsidian(SERVICE, result.envVars);
    writeToEnvFile(result.envVars, envFilePath);
    console.log("\n✅ 完成");
  }).catch((err) => {
    console.error("❌", err.message);
    process.exit(1);
  });
}
