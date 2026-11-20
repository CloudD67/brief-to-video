#!/usr/bin/env bash
# 安装便携版 Blender（story 的 CG 渲染引擎，macOS / Metal）。
# 不装系统路径、不污染 /Applications，解压到用户工具目录，Blender 自己挑 Apple GPU。
# 用法:
#   scripts/install-blender.sh                     # 安装到 ~/.qoder/tools/blender
#   scripts/install-blender.sh --dest DIR          # 指定安装目录
#   scripts/install-blender.sh --version 5.3.0     # 指定版本
#   scripts/install-blender.sh --mirror URL        # 换镜像（默认阿里云）
#   scripts/install-blender.sh --force             # 覆盖已安装的版本
set -euo pipefail

DEST="$HOME/.qoder/tools/blender"
VER="5.3.0"
MIRROR="https://mirrors.aliyun.com/blender/release"
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --version) VER="$2"; shift 2 ;;
    --mirror) MIRROR="${2%/}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help)
      sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
fail() { printf '错误: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || fail "这个脚本只做 macOS；其他平台请从 blender.org 手动安装，再用 config.cg.blender 指路径"
case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *) fail "未知架构: $(uname -m)" ;;
esac

BIN="$DEST/Blender.app/Contents/MacOS/Blender"
if [ -x "$BIN" ] && [ "$FORCE" = "0" ]; then
  say "已安装: $BIN"
  "$BIN" --version 2>/dev/null | head -1
  say "要换版本加 --force。"
  exit 0
fi

MAJOR_MINOR="${VER%.*}"
URL="$MIRROR/Blender$MAJOR_MINOR/blender-$VER-macos-$ARCH.dmg"

say "Blender $VER（macOS $ARCH）"
say "  来源  $URL"
say "  目标  $DEST"
say ""

TMP="$(mktemp -d)"
MNT="$TMP/mnt"
cleanup() {
  if mount | grep -q "on $MNT "; then hdiutil detach "$MNT" -quiet || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT

say "下载中…（约 300 MB，镜像快时 1–2 分钟）"
curl -fL --retry 3 --connect-timeout 20 -o "$TMP/blender.dmg" "$URL" \
  || fail "下载失败。可换镜像: --mirror https://download.blender.org/release"

mkdir -p "$MNT"
hdiutil attach -nobrowse -readonly -noverify -mountpoint "$MNT" "$TMP/blender.dmg" >/dev/null \
  || fail "挂载 dmg 失败"

[ -d "$MNT/Blender.app" ] || fail "dmg 里没有 Blender.app，下载可能不完整"

mkdir -p "$DEST"
if [ -e "$DEST/Blender.app" ]; then rm -rf "$DEST/Blender.app"; fi
say "复制 Blender.app …"
ditto "$MNT/Blender.app" "$DEST/Blender.app" || fail "复制失败"

hdiutil detach "$MNT" -quiet || true

[ -x "$BIN" ] || fail "安装后找不到可执行文件: $BIN"
"$BIN" --version 2>/dev/null | head -1

say ""
say "完成: $BIN"
say ""
say "下一步:"
say "  scripts/fetch-cg-assets.sh            # 下载 HDRI / PBR 素材（Poly Haven CC0）"
say "  工程里 config.js 写 engine: 'cg'，或临时指路径:"
say "    node tools/cg-render.js --blender \"$BIN\""
say "  cg_kit 会自动找到 $BIN（也可用环境变量 BLENDER_BIN 覆盖）。"