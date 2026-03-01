#!/usr/bin/env npx ts-node
/**
 * obsidian-config-reader.ts
 *
 * 从 Obsidian vault 读取服务配置，自动写入 .env 文件。
 *
 * 使用方式:
 *   npx ts-node obsidian-config-reader.ts [project] [--dry-run] [--env-file=.env]
 *
 * 示例:
 *   npx ts-node obsidian-config-reader.ts nautilus
 *   npx ts-node obsidian-config-reader.ts nautilus --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

// ─── 配置 ───────────────────────────────────────────────────────────────────

const VAULT_CONFIG_DIR = path.join(
  os.homedir(),
  "Library/Mobile Documents/iCloud~md~obsidian/Documents"
);
const CONFIGS_SUBDIR = "configs";

interface EnvVar {
  name: string;
  value: string;
  source: string; // 来源文件路径
}

interface ServiceNote {
  service: string;
  envVars: EnvVar[];
  canAutoFetch: boolean;
  authType: string;
  script?: string;
}

// ─── Obsidian 笔记解析 ───────────────────────────────────────────────────────

function findVaultRoot(): string {
  // 尝试常见的 Obsidian vault 路径
  const candidates = [
    VAULT_CONFIG_DIR,
    path.join(os.homedir(), "Documents/Obsidian"),
    path.join(os.homedir(), "Obsidian"),
    path.join(os.homedir(), "Notes"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, CONFIGS_SUBDIR))) {
      return candidate;
    }
  }

  throw new Error(
    `找不到 Obsidian vault。请确认 vault 根目录下有 ${CONFIGS_SUBDIR}/ 文件夹。\n` +
      `已尝试路径:\n${candidates.map((c) => `  - ${c}`).join("\n")}`
  );
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, unknown> = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (rawVal === "true") result[key] = true;
    else if (rawVal === "false") result[key] = false;
    else if (rawVal === "" || rawVal === "null") result[key] = null;
    else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      result[key] = rawVal
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    } else {
      result[key] = rawVal.replace(/^["']|["']$/g, "");
    }
  }

  return result;
}

/**
 * 从 markdown 表格中解析环境变量
 * 期望格式: | `ENV_VAR` | value | 说明 | 必填 |
 */
function parseEnvTable(content: string, sourceFile: string): EnvVar[] {
  const vars: EnvVar[] = [];
  const lines = content.split("\n");

  let inTable = false;
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("|")) {
      if (inTable) break;
      continue;
    }

    if (!inTable) {
      // 检测是否是环境变量表格（表头含 "变量名"）
      if (trimmed.includes("变量名") || trimmed.includes("ENV") || trimmed.includes("Variable")) {
        inTable = true;
        headerPassed = false;
        continue;
      }
    }

    if (inTable && !headerPassed) {
      // 跳过分割线 | --- | --- |
      if (trimmed.replace(/[\s|:-]/g, "").length === 0) {
        headerPassed = true;
        continue;
      }
    }

    if (inTable && headerPassed) {
      const cells = trimmed
        .slice(1, -1) // 去掉首尾 |
        .split("|")
        .map((c) => c.trim().replace(/^`|`$/g, "")); // 去掉反引号

      if (cells.length >= 2 && cells[0] && cells[0] !== "---") {
        const name = cells[0];
        const value = cells[1] || "";

        if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
          vars.push({ name, value, source: sourceFile });
        }
      }
    }
  }

  return vars;
}

function readServiceNote(notePath: string): ServiceNote | null {
  if (!fs.existsSync(notePath)) return null;

  const content = fs.readFileSync(notePath, "utf-8");
  const frontmatter = parseFrontmatter(content);
  const envVars = parseEnvTable(content, notePath);

  return {
    service: String(frontmatter.service || path.basename(notePath, ".md")),
    envVars,
    canAutoFetch: Boolean(frontmatter.can_auto_fetch),
    authType: String(frontmatter.auth_type || "manual"),
    script: frontmatter.script ? String(frontmatter.script) : undefined,
  };
}

// ─── 项目配置读取 ────────────────────────────────────────────────────────────

interface ProjectConfig {
  projectName: string;
  requiredServices: string[];
  envVars: EnvVar[];
}

function readProjectConfig(vaultRoot: string, projectName: string): ProjectConfig {
  const projectFile = path.join(
    vaultRoot,
    CONFIGS_SUBDIR,
    "projects",
    `${projectName}.md`
  );

  if (!fs.existsSync(projectFile)) {
    console.warn(`⚠️  未找到项目配置: configs/projects/${projectName}.md`);
    return { projectName, requiredServices: [], envVars: [] };
  }

  const content = fs.readFileSync(projectFile, "utf-8");
  const envVars = parseEnvTable(content, projectFile);

  // 从 [[services/xxx]] 链接中提取关联服务
  const serviceLinks = [...content.matchAll(/\[\[services\/([^\]]+)\]\]/g)].map(
    (m) => m[1]
  );

  return {
    projectName,
    requiredServices: [...new Set(serviceLinks)],
    envVars,
  };
}

// ─── 合并配置 ────────────────────────────────────────────────────────────────

interface ConfigResult {
  resolved: EnvVar[];          // 有值的变量
  missing: EnvVar[];           // 无值的变量
  autoFetchable: ServiceNote[]; // 可自动获取的服务
}

function mergeConfigs(
  vaultRoot: string,
  projectConfig: ProjectConfig
): ConfigResult {
  const resolved: EnvVar[] = [];
  const missing: EnvVar[] = [];
  const autoFetchable: ServiceNote[] = [];

  const servicesDir = path.join(vaultRoot, CONFIGS_SUBDIR, "services");

  // 收集项目直接定义的变量
  for (const v of projectConfig.envVars) {
    if (v.value) resolved.push(v);
    else missing.push(v);
  }

  // 从关联服务中补充变量
  for (const serviceName of projectConfig.requiredServices) {
    const notePath = path.join(servicesDir, `${serviceName}.md`);
    const note = readServiceNote(notePath);
    if (!note) continue;

    for (const v of note.envVars) {
      const alreadyTracked = [...resolved, ...missing].some((r) => r.name === v.name);
      if (alreadyTracked) continue;

      if (v.value) {
        resolved.push(v);
      } else {
        missing.push(v);
        if (note.canAutoFetch) {
          const alreadyListed = autoFetchable.some((s) => s.service === note.service);
          if (!alreadyListed) autoFetchable.push(note);
        }
      }
    }
  }

  return { resolved, missing, autoFetchable };
}

// ─── .env 写入 ───────────────────────────────────────────────────────────────

function writeEnvFile(
  envFilePath: string,
  vars: EnvVar[],
  dryRun: boolean
): void {
  const existing: Record<string, string> = {};

  if (fs.existsSync(envFilePath)) {
    const lines = fs.readFileSync(envFilePath, "utf-8").split("\n");
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1 || line.startsWith("#")) continue;
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim();
      existing[k] = v;
    }
  }

  let added = 0;
  let skipped = 0;

  for (const v of vars) {
    if (!v.value) continue;
    if (existing[v.name]) {
      skipped++;
      continue;
    }
    existing[v.name] = v.value;
    added++;
  }

  if (dryRun) {
    console.log(`\n[dry-run] 将写入 ${envFilePath}:`);
    for (const v of vars) {
      if (!v.value) continue;
      const masked = v.value.slice(0, 6) + "****";
      console.log(`  ${v.name}=${masked}`);
    }
    return;
  }

  const lines = Object.entries(existing).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envFilePath, lines.join("\n") + "\n");
  console.log(`✅ 写入 ${envFilePath}：新增 ${added} 个，跳过已有 ${skipped} 个`);
}

// ─── 用户交互 ────────────────────────────────────────────────────────────────

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function handleMissingVars(missing: EnvVar[], autoFetchable: ServiceNote[]): Promise<EnvVar[]> {
  if (missing.length === 0) return [];

  console.log("\n⚠️  以下变量在 Obsidian 中没有配置值：");
  for (const v of missing) {
    const service = autoFetchable.find((s) =>
      s.envVars.some((sv) => sv.name === v.name)
    );
    const tag = service ? `[可自动获取: ${service.service}]` : "[需手动填写]";
    console.log(`  - ${v.name} ${tag}`);
  }

  if (autoFetchable.length > 0) {
    console.log("\n以下服务支持自动获取配置（需要浏览器已登录）：");
    for (const s of autoFetchable) {
      console.log(`  - ${s.service} (${s.authType})`);
      if (s.script) console.log(`    脚本: ${s.script}`);
    }
    console.log("\n运行自动获取脚本后，请重新执行此命令。");
  }

  const answer = await promptUser(
    "\n是否现在手动输入缺失的变量值？[y/N] "
  );

  const filled: EnvVar[] = [];
  if (answer.toLowerCase() === "y") {
    for (const v of missing) {
      const val = await promptUser(`  ${v.name} = `);
      if (val) filled.push({ ...v, value: val });
    }
  }

  return filled;
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const projectName = args.find((a: string) => !a.startsWith("--")) || "default";
  const dryRun = args.includes("--dry-run");
  const envFileArg = args.find((a: string) => a.startsWith("--env-file="));
  const envFilePath = envFileArg
    ? envFileArg.split("=")[1]
    : path.join(process.cwd(), ".env");

  console.log(`\n📖 读取 Obsidian 配置 [项目: ${projectName}]`);
  if (dryRun) console.log("   模式: dry-run（不实际写入）");

  let vaultRoot: string;
  try {
    vaultRoot = findVaultRoot();
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}`);
    return;
  }
  console.log(`   Vault: ${vaultRoot}`);

  const projectConfig = readProjectConfig(vaultRoot, projectName);
  const { resolved, missing, autoFetchable } = mergeConfigs(vaultRoot, projectConfig);

  console.log(`\n📋 配置摘要:`);
  console.log(`   已配置: ${resolved.length} 个变量`);
  console.log(`   缺失: ${missing.length} 个变量`);

  // 写入已有值的变量
  writeEnvFile(envFilePath, resolved, dryRun);

  // 处理缺失变量
  const manualFilled = await handleMissingVars(missing, autoFetchable);
  if (manualFilled.length > 0) {
    writeEnvFile(envFilePath, manualFilled, dryRun);
  }

  const stillMissing = missing.filter(
    (v) => !manualFilled.some((f) => f.name === v.name)
  );

  if (stillMissing.length > 0) {
    console.log("\n⚠️  仍有以下变量未配置，服务启动可能失败：");
    stillMissing.forEach((v) => console.log(`   - ${v.name}`));
    console.log(
      `\n提示：在 Obsidian 中填写 configs/services/<service>.md 后重新运行此脚本。`
    );
  } else {
    console.log("\n✅ 所有配置已就绪");
  }
}

main().catch((err) => {
  console.error("❌ 运行出错:", err.message);
  process.exit(1);
});
