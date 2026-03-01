/**
 * fetchers/anthropic.ts
 *
 * 自动从 Anthropic Console 创建 API Key 并返回。
 *
 * 流程：
 * 1. 用持久化 session 打开浏览器（已登录则跳过登录步骤）
 * 2. 导航到 /settings/keys
 * 3. 点击 "Create Key" → 填写名称 → 复制生成的 key
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

const SERVICE = "anthropic";
const LOGIN_URL = "https://console.anthropic.com";
const KEYS_URL = "https://console.anthropic.com/settings/keys";
const LOGGED_IN_PATTERN = /console\.anthropic\.com\/(dashboard|settings|workbench)/;

async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto(KEYS_URL, { waitUntil: "domcontentloaded" });
  return LOGGED_IN_PATTERN.test(page.url());
}

async function createKey(page: Page, keyName: string): Promise<string> {
  await page.goto(KEYS_URL, { waitUntil: "networkidle" });

  // 点击创建按钮（尝试多种可能的文本）
  const createBtn = page.locator(
    'button:has-text("Create Key"), button:has-text("Create key"), button:has-text("New key")'
  ).first();
  await createBtn.waitFor({ timeout: 10_000 });
  await createBtn.click();

  // 填写 key 名称
  const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="key" i], input[type="text"]').first();
  await nameInput.waitFor({ timeout: 5_000 });
  await nameInput.fill(keyName);

  // 点击确认创建
  const confirmBtn = page.locator(
    'button:has-text("Create Key"), button:has-text("Create"), [data-testid="create-key-submit"]'
  ).last();
  await confirmBtn.click();

  // 等待 key 显示
  console.log("   等待 API Key 生成...");
  await waitForUserAction(
    page,
    "如看到 API Key 已显示在对话框中，请等待脚本自动复制...",
    'input[value^="sk-ant-"], [data-testid="api-key-value"], code:has-text("sk-ant-")',
    30_000
  );

  // 读取 key 值
  const keyEl = page.locator('input[value^="sk-ant-"]').first();
  const keyFromInput = await keyEl.inputValue().catch(() => "");
  if (keyFromInput) return keyFromInput;

  // 备选：从 code/pre 元素中读取
  const keyText = await page
    .locator('code:has-text("sk-ant-"), pre:has-text("sk-ant-")')
    .first()
    .innerText()
    .catch(() => "");

  const match = keyText.match(/sk-ant-\S+/);
  if (match) return match[0];

  throw new Error("无法自动读取生成的 API Key，请手动复制后填写 Obsidian。");
}

export async function fetchAnthropicKey(
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

    console.log("   正在 Anthropic Console 创建 API Key...");
    const apiKey = await createKey(page, keyName);

    const envVars = { ANTHROPIC_API_KEY: apiKey };
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

  console.log(`\n🔑 Anthropic API Key 自动获取`);

  fetchAnthropicKey().then((result) => {
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
