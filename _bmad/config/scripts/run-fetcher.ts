#!/usr/bin/env npx ts-node
/**
 * run-fetcher.ts — Playwright 配置自动获取 CLI 入口
 *
 * 使用方式:
 *   npx ts-node scripts/run-fetcher.ts <service> [--env-file=.env] [--prefix=myapp]
 *
 * 支持的 service:
 *   anthropic   - 获取 ANTHROPIC_API_KEY
 *   openai      - 获取 OPENAI_API_KEY (+ OPENAI_ORG_ID)
 *   github      - 获取 GITHUB_TOKEN (+ GITHUB_USERNAME)
 *
 * 示例:
 *   npx ts-node scripts/run-fetcher.ts anthropic
 *   npx ts-node scripts/run-fetcher.ts github --env-file=.env.local
 *   npx ts-node scripts/run-fetcher.ts openai --prefix=my-project
 */

import * as path from "path";
import { writeToObsidian, writeToEnvFile } from "./fetchers/_base";

// 解析 CLI 参数
const args = process.argv.slice(2);
const service = args.find((a: string) => !a.startsWith("--"));
const envFileArg = args.find((a: string) => a.startsWith("--env-file="));
const prefixArg = args.find((a: string) => a.startsWith("--prefix="));

const envFilePath = envFileArg
  ? envFileArg.split("=")[1]
  : path.join(process.cwd(), ".env");

const keyNamePrefix = prefixArg ? prefixArg.split("=")[1] : "bmad";

const SUPPORTED = ["anthropic", "openai", "github"] as const;
type SupportedService = typeof SUPPORTED[number];

function printHelp() {
  console.log(`
使用方式:
  npx ts-node scripts/run-fetcher.ts <service> [选项]

支持的服务:
  anthropic   获取 ANTHROPIC_API_KEY
  openai      获取 OPENAI_API_KEY, OPENAI_ORG_ID
  github      获取 GITHUB_TOKEN, GITHUB_USERNAME

选项:
  --env-file=<path>   写入的 .env 文件路径（默认: .env）
  --prefix=<name>     创建的 key/token 名称前缀（默认: bmad）

示例:
  npx ts-node scripts/run-fetcher.ts anthropic
  npx ts-node scripts/run-fetcher.ts github --env-file=.env.local
  `);
}

async function main() {
  if (!service || !SUPPORTED.includes(service as SupportedService)) {
    console.error(
      service
        ? `❌ 不支持的服务: ${service}。支持: ${SUPPORTED.join(", ")}`
        : "❌ 请指定服务名称"
    );
    printHelp();
    process.exit(1);
  }

  const opts = { keyNamePrefix };

  console.log(`\n🚀 自动获取配置 [服务: ${service}]`);
  console.log(`   目标 .env: ${envFilePath}`);
  console.log(`   Key 前缀: ${keyNamePrefix}\n`);

  let result;

  switch (service as SupportedService) {
    case "anthropic": {
      const { fetchAnthropicKey } = await import("./fetchers/anthropic");
      result = await fetchAnthropicKey(opts);
      break;
    }
    case "openai": {
      const { fetchOpenAIKey } = await import("./fetchers/openai");
      result = await fetchOpenAIKey(opts);
      break;
    }
    case "github": {
      const { fetchGitHubToken } = await import("./fetchers/github");
      result = await fetchGitHubToken(opts);
      break;
    }
  }

  if (!result!.success) {
    console.error(`\n❌ 获取失败: ${result!.error}`);
    process.exit(1);
  }

  const varCount = Object.keys(result!.envVars).length;
  console.log(`\n📦 获取到 ${varCount} 个环境变量:`);
  for (const [k, v] of Object.entries(result!.envVars)) {
    console.log(`   ${k}=${v.slice(0, 8)}****`);
  }

  writeToObsidian(service, result!.envVars);
  writeToEnvFile(result!.envVars, envFilePath);

  console.log("\n✅ 全部完成");
}

main().catch((err) => {
  console.error("❌ 运行出错:", err.message);
  process.exit(1);
});
