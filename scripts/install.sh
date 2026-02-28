#!/usr/bin/env bash
# install.sh — 将 BMAD AgentTeam 框架安装到目标项目
# 用法：
#   在目标项目根目录执行：
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/bmad-framework/main/scripts/install.sh | bash
#   或本地执行：
#   bash /path/to/bmad-framework/scripts/install.sh

set -euo pipefail

BMAD_VERSION="6.0.3"
REPO_URL="https://github.com/YOUR_ORG/bmad-framework"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_DIR="$(dirname "$SCRIPT_DIR")"

# ── 颜色输出 ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[bmad]${NC} $*"; }
success() { echo -e "${GREEN}[bmad]${NC} $*"; }
warn()    { echo -e "${YELLOW}[bmad]${NC} $*"; }
error()   { echo -e "${RED}[bmad]${NC} $*" >&2; }

# ── 前置检查 ─────────────────────────────────────────────────────────────────
check_prerequisites() {
  local missing=()
  command -v git  >/dev/null 2>&1 || missing+=("git")
  command -v sed  >/dev/null 2>&1 || missing+=("sed")
  if [[ ${#missing[@]} -gt 0 ]]; then
    error "缺少依赖：${missing[*]}"
    exit 1
  fi
}

# ── 获取框架文件来源 ──────────────────────────────────────────────────────────
# 本地执行时直接用脚本所在目录；curl 管道执行时从 GitHub 克隆
resolve_framework_source() {
  # 如果 _bmad 目录与脚本同级，说明是本地执行
  if [[ -d "$FRAMEWORK_DIR/_bmad" ]]; then
    SOURCE_DIR="$FRAMEWORK_DIR"
    info "使用本地框架：$SOURCE_DIR"
  else
    info "从 GitHub 拉取框架 v${BMAD_VERSION}..."
    TMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TMP_DIR"' EXIT
    git clone --depth=1 "$REPO_URL" "$TMP_DIR/bmad-framework" 2>/dev/null \
      || { error "拉取失败，请检查网络或 REPO_URL 配置"; exit 1; }
    SOURCE_DIR="$TMP_DIR/bmad-framework"
  fi
}

# ── 交互式收集配置 ────────────────────────────────────────────────────────────
# 支持环境变量非交互式模式：
#   PROJECT_NAME=myapp USER_NAME=Alice LANGUAGE=Chinese bash install.sh
collect_config() {
  # 默认值推断
  local default_project default_user
  default_project=$(basename "$(pwd)")
  default_user=${USER:-$(git config user.name 2>/dev/null || echo "Developer")}

  # 若已通过环境变量提供，跳过交互
  if [[ -n "${PROJECT_NAME:-}" && -n "${USER_NAME:-}" && -n "${LANGUAGE:-}" ]]; then
    info "非交互式模式（使用环境变量配置）"
    PROJECT_NAME="${PROJECT_NAME}"
    USER_NAME="${USER_NAME}"
    LANGUAGE="${LANGUAGE}"
  else
    # 交互式模式（需要 tty）
    if [[ ! -t 0 ]]; then
      error "stdin 不是终端，请用环境变量模式："
      error "  PROJECT_NAME=myapp USER_NAME=Alice LANGUAGE=Chinese bash install.sh"
      exit 1
    fi

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  BMAD AgentTeam 框架安装 v${BMAD_VERSION}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    read -rp "项目名称 [${default_project}]: " PROJECT_NAME
    PROJECT_NAME="${PROJECT_NAME:-$default_project}"

    read -rp "你的名字 [${default_user}]: " USER_NAME
    USER_NAME="${USER_NAME:-$default_user}"

    echo "语言选项: 1) 中文  2) English"
    read -rp "选择语言 [1]: " LANG_CHOICE
    case "${LANG_CHOICE:-1}" in
      2) LANGUAGE="English" ;;
      *) LANGUAGE="Chinese" ;;
    esac

    echo ""
    echo "  项目名称：$PROJECT_NAME"
    echo "  用户名：  $USER_NAME"
    echo "  语言：    $LANGUAGE"
    echo ""
    read -rp "确认安装? [Y/n]: " CONFIRM
    [[ "${CONFIRM:-Y}" =~ ^[Nn]$ ]] && { info "已取消"; exit 0; }
  fi
}

# ── 安装框架文件 ───────────────────────────────────────────────────────────────
install_framework() {
  local target_dir="$PWD"

  # 1. 复制 _bmad/ 框架文件
  info "复制 _bmad/ 框架文件..."
  if [[ -d "$target_dir/_bmad" ]]; then
    warn "_bmad/ 目录已存在，将覆盖更新"
    rm -rf "$target_dir/_bmad"
  fi
  cp -r "$SOURCE_DIR/_bmad" "$target_dir/_bmad"

  # 清理 _memory（运行时数据，不随框架分发）
  rm -rf "$target_dir/_bmad/_memory"
  mkdir -p "$target_dir/_bmad/_memory"

  # 2. 写入 config.yaml（填充用户配置）
  info "生成配置文件..."
  fill_template "$SOURCE_DIR/templates/core-config.yaml.tmpl" \
                "$target_dir/_bmad/core/config.yaml"
  fill_template "$SOURCE_DIR/templates/bmm-config.yaml.tmpl" \
                "$target_dir/_bmad/bmm/config.yaml"

  # 3. 生成 CLAUDE.md
  info "生成 CLAUDE.md..."
  if [[ -f "$target_dir/CLAUDE.md" ]]; then
    warn "CLAUDE.md 已存在，备份为 CLAUDE.md.bak"
    cp "$target_dir/CLAUDE.md" "$target_dir/CLAUDE.md.bak"
  fi
  fill_template "$SOURCE_DIR/templates/CLAUDE.md.tmpl" "$target_dir/CLAUDE.md"

  # 4. 更新 .gitignore
  info "更新 .gitignore..."
  update_gitignore "$target_dir"

  # 5. 创建 docs/ 目录（project_knowledge 默认路径）
  mkdir -p "$target_dir/docs"
}

# ── 模板变量替换 ───────────────────────────────────────────────────────────────
fill_template() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  sed \
    -e "s|{{PROJECT_NAME}}|$PROJECT_NAME|g" \
    -e "s|{{USER_NAME}}|$USER_NAME|g" \
    -e "s|{{LANGUAGE}}|$LANGUAGE|g" \
    "$src" > "$dst"
}

# ── 更新 .gitignore ───────────────────────────────────────────────────────────
update_gitignore() {
  local target_dir="$1"
  local gitignore="$target_dir/.gitignore"

  touch "$gitignore"

  append_if_missing() {
    local line="$1"
    grep -qxF "$line" "$gitignore" || echo "$line" >> "$gitignore"
  }

  # evolution log 是运行时数据，不纳入版本
  append_if_missing "# BMAD runtime data"
  append_if_missing "_bmad/_memory/"
  # Sprint 产物按需决定是否 commit（默认忽略）
  append_if_missing "_bmad-output/"
  # 环境配置
  append_if_missing ".env"
}

# ── 完成提示 ───────────────────────────────────────────────────────────────────
print_success() {
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  BMAD AgentTeam 安装完成！${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  已安装到：$(pwd)"
  echo ""
  echo "  下一步："
  echo "    1. 在当前目录打开 Claude Code：claude"
  echo "    2. 描述你的需求，BMAD 会自动判断模式并启动团队"
  echo "    3. Solo Mode / Sprint Mode 文档见 CLAUDE.md"
  echo ""
  echo "  框架文件："
  echo "    _bmad/          ← BMAD 框架（不要手动修改）"
  echo "    CLAUDE.md       ← Claude Code 操作规则"
  echo "    docs/           ← 项目知识库（可随时添加文档）"
  echo ""
}

# ── 主流程 ────────────────────────────────────────────────────────────────────
main() {
  check_prerequisites
  resolve_framework_source
  collect_config
  install_framework
  print_success
}

main "$@"
