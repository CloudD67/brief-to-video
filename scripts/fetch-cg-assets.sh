#!/usr/bin/env bash
# 下载 CG 镜头用的真实素材（Poly Haven，CC0 公共领域，可商用）。
# 默认放 ~/.qoder/tools/cg-library，cg_kit 的 film.py 按约定路径读取。
# 用法:
#   scripts/fetch-cg-assets.sh                 # 下载到 ~/.qoder/tools/cg-library
#   scripts/fetch-cg-assets.sh --dest DIR      # 指定素材根目录
#   scripts/fetch-cg-assets.sh --force         # 重新下载已存在的文件
set -euo pipefail

DEST="$HOME/.qoder/tools/cg-library"
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help)
      sed -n '2,7p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
fail() { printf '错误: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "需要 curl"

HDRI_BASE="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k"
TEX_BASE="https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k"

fetch() { # fetch <url> <相对路径>
  local url="$1" rel="$2" out="$DEST/$2"
  if [ -s "$out" ] && [ "$FORCE" = "0" ]; then
    say "  已有  $rel"
    return 0
  fi
  mkdir -p "$(dirname "$out")"
  say "  下载  $rel"
  curl -fL --retry 3 --connect-timeout 20 -o "$out.part" "$url" \
    || { rm -f "$out.part"; fail "下载失败: $url"; }
  mv "$out.part" "$out"
}

mkdir -p "$DEST"
say "CG 素材 → $DEST"
say ""

fetch "$HDRI_BASE/cobblestone_street_night_2k.hdr" "hdri/cobblestone_street_night_2k.hdr"
fetch "$TEX_BASE/asphalt_04/asphalt_04_diff_1k.jpg" "pbr/asphalt_04/asphalt_04_diff_1k.jpg"
fetch "$TEX_BASE/asphalt_04/asphalt_04_rough_1k.jpg" "pbr/asphalt_04/asphalt_04_rough_1k.jpg"
fetch "$TEX_BASE/asphalt_04/asphalt_04_nor_gl_1k.jpg" "pbr/asphalt_04/asphalt_04_nor_gl_1k.jpg"
fetch "$TEX_BASE/asphalt_04/asphalt_04_ao_1k.jpg" "pbr/asphalt_04/asphalt_04_ao_1k.jpg"

LIC="$DEST/LICENSE.txt"
if [ ! -s "$LIC" ]; then
  cat > "$LIC" <<'EOF'
CG asset library — Poly Haven (https://polyhaven.com)
License: CC0 1.0 Universal (public domain). Free for commercial use, no attribution required.

  hdri/cobblestone_street_night_2k.hdr   — Poly Haven "cobblestone_street_night" (HDRI)
  pbr/asphalt_04/asphalt_04_*_1k.jpg     — Poly Haven "asphalt_04" (diffuse/rough/normal/AO)

Keep this file with the assets when copying them between machines.
EOF
fi

say ""
say "完成。工程里 film.py 用 asset('hdri/…') / asset('pbr/…') 读取；"
say "素材放在别处时用环境变量 CG_ASSETS 指向素材根目录。"
du -sh "$DEST" 2>/dev/null | awk '{print "  当前占用 " $1}'