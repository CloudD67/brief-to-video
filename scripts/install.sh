#!/usr/bin/env bash
# 安装 brief-to-video 到 Qoder skills 目录。
# 用法:
#   scripts/install.sh                 # 安装到 ~/.qoder/skills/brief-to-video
#   scripts/install.sh --dest DIR      # 安装到指定目录
#   scripts/install.sh --link          # 开发模式：软链当前目录
#   scripts/install.sh --force         # 覆盖已存在的目标目录
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.qoder/skills/brief-to-video"
MODE="copy"
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --link) MODE="link"; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help)
      sed -n '2,7p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
fail() { printf '错误: %s\n' "$*" >&2; exit 1; }

[ -f "$SRC/SKILL.md" ] || fail "找不到 $SRC/SKILL.md，请在完整 skill 目录内运行"
[ -d "$SRC/assets/template" ] || fail "缺少 assets/template，skill 包不完整"

if ! command -v node >/dev/null 2>&1; then
  fail "未找到 node。请先安装 Node.js 18+（建议 20 LTS）"
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 版本过低（当前 $(node -v)），需要 18+"

SRC_REAL="$(cd "$SRC" && pwd -P)"
mkdir -p "$(dirname "$DEST")"
DEST_PARENT="$(cd "$(dirname "$DEST")" && pwd -P)"
DEST_REAL="$DEST_PARENT/$(basename "$DEST")"
if [ "$SRC_REAL" = "$DEST_REAL" ]; then
  say "已在该目录：$DEST（无需安装）"
  exit 0
fi
case "$DEST_REAL/" in
  "$SRC_REAL"/*) fail "目标目录不能位于 skill 目录内：$DEST_REAL" ;;
esac

if [ "$MODE" = "link" ]; then
  if [ -e "$DEST" ] || [ -L "$DEST" ]; then
    [ "$FORCE" = "1" ] || fail "$DEST 已存在，加 --force 替换"
    rm -rf "$DEST"
  fi
  mkdir -p "$(dirname "$DEST")"
  ln -s "$SRC" "$DEST"
  say "已软链: $DEST -> $SRC"
  exit 0
fi

if [ -e "$DEST" ]; then
  [ "$FORCE" = "1" ] || fail "$DEST 已存在。升级请加 --force（会替换旧版本）"
  rm -rf "$DEST"
fi
mkdir -p "$DEST"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude node_modules --exclude 'frames' --exclude 'out' --exclude 'stills' --exclude 'qa' "$SRC/" "$DEST/"
else
  (cd "$SRC" && tar --exclude node_modules --exclude frames --exclude out --exclude stills --exclude qa -cf - .) | (cd "$DEST" && tar -xf -)
fi

[ -f "$DEST/SKILL.md" ] || fail "安装后缺少 SKILL.md"
[ -f "$DEST/assets/template/render.js" ] || fail "安装后模板不完整"

VER="$(cat "$DEST/VERSION" 2>/dev/null || echo unknown)"
say "brief-to-video $VER 已安装到: $DEST"
say ""
say "下一步:"
say "  1. 在 Qoder 会话里说：帮我做一个 30 秒的 ___ 宣传视频"
say "     或手动建工程：node \"$DEST/scripts/new-film.js\" ./my-film --title \"标题\""
say "  2. cd 到工程目录后 npm install"
say "  3. node tools/doctor.js . && npm run qa"
say ""
say "注意: 模板工程首次运行需要 npm install（puppeteer / ffmpeg 安装包）。"
say "卸载: rm -rf \"$DEST\""
