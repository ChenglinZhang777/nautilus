/**
 * _base.ts — Playwright fetcher 基础设施
 *
 * 提供：
 * - 持久化浏览器会话（复用登录 cookie，避免重复登录）
 * - 登录等待流程（打开可见窗口 → 等待用户完成登录/MFA）
 * - 结果写回 Obsidian 和 .env
 */

import { chromium, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

// ─── 路径配置 ─────────────────────────────────────────────────────────────────

/** 浏览器会话存储目录，每个服务独立 */
export const SESSION_BASE_DIR = path.join(os.homedir(), ".config", "bmad-fetcher");

/** Obsidian vault 根目录（含 configs/ 的那一层） */
export function findVaultRoot(): string {
  const candidates = [
    path.join(os.homedir(), "obsidian"),
    path.join(os.homedir(), "Library/Mobile Documents/iCloud~md~obsidian/Documents"),
    path.join(os.homedir(), "Documents/Obsidian"),
    path.join(os.homedir(), "Notes"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "configs"))) return c;
  }
  throw new Error(
    `找不到 Obsidian vault（含 configs/ 的目录）。\n已尝试:\n${candidates.map((c) => `  ${c}`).join("\n")}`
  );
}

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface FetchResult {
  success: boolean;
  /** 成功获取的环境变量，key = 变量名，value = 变量值 */
  envVars: Record<string, string>;
  error?: string;
}

export interface FetcherOptions {
  /** 是否在无头模式下运行（默认 false，需要用户可见操作时打开浏览器） */
  headless?: boolean;
  /** 创建 key 时使用的名称前缀 */
  keyNamePrefix?: string;
}

// ─── 浏览器会话管理 ───────────────────────────────────────────────────────────

export async function launchContext(service: string): Promise<BrowserContext> {
  const userDataDir = path.join(SESSION_BASE_DIR, service);
  fs.mkdirSync(userDataDir, { recursive: true });

  // persistentContext 会保存 cookie/localStorage，下次启动自动恢复登录态
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // 始终显示窗口，用户可看到操作过程
    viewport: { width: 1280, height: 800 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

  return context;
}

// ─── 登录等待 ─────────────────────────────────────────────────────────────────

/**
 * 等待用户在可见浏览器中完成登录。
 * 检测方式：页面 URL 变为 `successUrlPattern` 匹配的地址。
 */
export async function waitForLogin(
  page: Page,
  loginUrl: string,
  successUrlPattern: RegExp,
  timeoutMs = 3 * 60 * 1000
): Promise<void> {
  if (successUrlPattern.test(page.url())) return; // 已登录

  console.log(`\n🌐 请在浏览器中完成登录：${loginUrl}`);
  console.log("   登录完成后脚本将自动继续...\n");

  await page.goto(loginUrl);

  await page.waitForURL(successUrlPattern, { timeout: timeoutMs }).catch(() => {
    throw new Error(`登录超时（${timeoutMs / 1000}s）。请重新运行脚本。`);
  });
}

/**
 * 等待用户在浏览器中完成某个需要人工操作的步骤（MFA、验证码等）。
 * 检测方式：等待 `readySelector` 元素出现。
 */
export async function waitForUserAction(
  page: Page,
  promptMessage: string,
  readySelector: string,
  timeoutMs = 2 * 60 * 1000
): Promise<void> {
  console.log(`\n⏳ ${promptMessage}`);
  await page.waitForSelector(readySelector, { timeout: timeoutMs }).catch(() => {
    throw new Error(`等待超时（${timeoutMs / 1000}s）。`);
  });
}

// ─── 用户交互 ─────────────────────────────────────────────────────────────────

export async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Obsidian 写回 ────────────────────────────────────────────────────────────

/**
 * 将获取到的变量值写回 Obsidian 服务配置文件的 Markdown 表格中。
 * 匹配格式: | `ENV_VAR_NAME` | <值写这里> | ... |
 */
export function writeToObsidian(
  service: string,
  envVars: Record<string, string>
): void {
  let vaultRoot: string;
  try {
    vaultRoot = findVaultRoot();
  } catch {
    console.warn("⚠️  无法找到 Obsidian vault，跳过写回 Obsidian。");
    return;
  }

  const notePath = path.join(vaultRoot, "configs", "services", `${service}.md`);
  if (!fs.existsSync(notePath)) {
    console.warn(`⚠️  Obsidian 配置文件不存在: ${notePath}`);
    return;
  }

  let content = fs.readFileSync(notePath, "utf-8");
  let updated = false;

  for (const [name, value] of Object.entries(envVars)) {
    // 匹配表格行: | `NAME` | <旧值或空> | 后续列... |
    const rowPattern = new RegExp(
      `(\\|\\s*\`${name}\`\\s*\\|\\s*)([^|]*)?(\\|.*)`,
      "g"
    );
    const replaced = content.replace(rowPattern, `$1${value}$3`);
    if (replaced !== content) {
      content = replaced;
      updated = true;
    }
  }

  if (updated) {
    // 更新 last_updated 日期
    const today = new Date().toISOString().split("T")[0];
    content = content.replace(
      /^last_updated:\s*.*/m,
      `last_updated: ${today}`
    );
    fs.writeFileSync(notePath, content, "utf-8");
    console.log(`✅ 已写回 Obsidian: configs/services/${service}.md`);
  }
}

// ─── .env 写入 ────────────────────────────────────────────────────────────────

export function writeToEnvFile(
  envVars: Record<string, string>,
  envFilePath: string
): void {
  const existing: Record<string, string> = {};

  if (fs.existsSync(envFilePath)) {
    for (const line of fs.readFileSync(envFilePath, "utf-8").split("\n")) {
      const eq = line.indexOf("=");
      if (eq === -1 || line.startsWith("#")) continue;
      existing[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }

  let added = 0;
  for (const [k, v] of Object.entries(envVars)) {
    if (!existing[k]) {
      existing[k] = v;
      added++;
    }
  }

  const lines = Object.entries(existing).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envFilePath, lines.join("\n") + "\n");
  console.log(`✅ 已写入 ${envFilePath}（新增 ${added} 个变量）`);
}
