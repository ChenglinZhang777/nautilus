/**
 * fetchers/github.ts
 *
 * 自动在 GitHub 创建 Classic Personal Access Token 并返回。
 *
 * 注意：
 * - GitHub token 只在创建时显示，无法从列表读回已有 token 的值
 * - 如启用了 2FA，脚本会暂停并提示用户在浏览器中完成验证
 * - 默认权限：repo, workflow, read:org（可通过选项覆盖）
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

const SERVICE = "github";
const LOGIN_URL = "https://github.com/login";
const TOKEN_URL = "https://github.com/settings/tokens/new";
const LOGGED_IN_PATTERN = /github\.com\/(?!login|session|signup)/;

/** 默认勾选的权限 scopes */
const DEFAULT_SCOPES = ["repo", "workflow", "read:org"];

async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto("https://github.com", { waitUntil: "domcontentloaded" });
  return !page.url().includes("/login") && !page.url().includes("/session");
}

async function createToken(
  page: Page,
  tokenName: string,
  scopes: string[]
): Promise<string> {
  await page.goto(TOKEN_URL, { waitUntil: "networkidle" });

  // GitHub 有时会要求 sudo 模式（重新验证密码），检测并等待
  const sudoPrompt = page.locator('input[name="sudo_login"], form[action*="sudo"]');
  if (await sudoPrompt.isVisible().catch(() => false)) {
    console.log("\n⚠️  GitHub 需要重新验证身份（sudo 模式）");
    await waitForUserAction(
      page,
      "请在浏览器中完成身份验证后等待...",
      'input[name="description"]',
      120_000
    );
  }

  // 填写 token 名称
  const nameInput = page.locator('input[name="description"]');
  await nameInput.waitFor({ timeout: 10_000 });
  await nameInput.fill(tokenName);

  // 设置不过期
  const expirationSelect = page.locator('select[name="oauth_access[expires_in]"]');
  if (await expirationSelect.isVisible().catch(() => false)) {
    await expirationSelect.selectOption("0"); // 0 = no expiration
  }

  // 勾选权限
  for (const scope of scopes) {
    // scope checkbox 的 id/name 可能是 "repo", "workflow" 等
    const checkbox = page.locator(
      `input[name="${scope}"], input[id="${scope}"], input[value="${scope}"]`
    ).first();
    const checked = await checkbox.isChecked().catch(() => false);
    if (!checked) await checkbox.check().catch(() => null);
  }

  // 点击生成 token
  const generateBtn = page.locator(
    'input[type="submit"][value*="Generate"], button:has-text("Generate token")'
  ).first();
  await generateBtn.click();

  // 等待 2FA 验证（如果有）
  const mfaInput = page.locator(
    'input[name="app_otp"], input[autocomplete="one-time-code"]'
  );
  if (await mfaInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    console.log("\n🔐 GitHub 需要 2FA 验证");
    await waitForUserAction(
      page,
      "请在浏览器中完成 2FA 验证后等待...",
      // 验证完成后会跳转到 token 显示页
      '.token-attribute code, #new-oauth-token',
      120_000
    );
  }

  // 读取生成的 token
  await page.waitForURL(/github\.com\/settings\/tokens\/\d+/, { timeout: 30_000 })
    .catch(() => null);

  const tokenEl = page.locator(
    '.token-attribute code, #new-oauth-token, [data-testid="token-value"]'
  ).first();
  await tokenEl.waitFor({ timeout: 15_000 });

  const token = await tokenEl.innerText();
  if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
    throw new Error(`获取到的 token 格式异常: ${token.slice(0, 10)}...`);
  }

  // 获取用户名（后续可选使用）
  const userLogin = await page
    .locator('[data-login], [data-hovercard-url*="/users/"]')
    .first()
    .getAttribute("data-login")
    .catch(() => null);

  console.log(`   Token 创建成功: ${token.slice(0, 10)}...`);
  if (userLogin) console.log(`   用户名: ${userLogin}`);

  return token;
}

export interface GitHubFetcherOptions extends FetcherOptions {
  scopes?: string[];
}

export async function fetchGitHubToken(
  opts: GitHubFetcherOptions = {}
): Promise<FetchResult> {
  const tokenName = `${opts.keyNamePrefix ?? "bmad"}-${Date.now()}`;
  const scopes = opts.scopes ?? DEFAULT_SCOPES;
  const context = await launchContext(SERVICE);

  try {
    const page = await context.newPage();

    if (!(await isLoggedIn(page))) {
      await waitForLogin(page, LOGIN_URL, LOGGED_IN_PATTERN);
    }

    // 获取用户名（用于 GITHUB_USERNAME 变量）
    const username = await page
      .locator('[data-login]')
      .first()
      .getAttribute("data-login")
      .catch(() => null);

    console.log("   正在 GitHub 创建 Personal Access Token...");
    const token = await createToken(page, tokenName, scopes);

    const envVars: Record<string, string> = { GITHUB_TOKEN: token };
    if (username) envVars["GITHUB_USERNAME"] = username;

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

  console.log(`\n🔑 GitHub Token 自动获取`);
  console.log(`   权限: ${DEFAULT_SCOPES.join(", ")}`);

  fetchGitHubToken().then((result) => {
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
