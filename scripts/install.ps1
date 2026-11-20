# 安装 brief-to-video 到 Qoder skills 目录（Windows）。
# 用法:
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Dest D:\skills\brief-to-video
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Force    # 覆盖旧版本
param(
  [string]$Dest = (Join-Path $HOME ".qoder\skills\brief-to-video"),
  [switch]$Force
)
$ErrorActionPreference = "Stop"

$Src = Split-Path -Parent $PSScriptRoot
function Fail([string]$msg) { Write-Host ("错误: " + $msg) -ForegroundColor Red; exit 1 }

if (-not (Test-Path (Join-Path $Src "SKILL.md"))) { Fail "找不到 SKILL.md，请在完整 skill 目录内运行" }
if (-not (Test-Path (Join-Path $Src "assets\template"))) { Fail "缺少 assets\template，skill 包不完整" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "未找到 node。请先安装 Node.js 18+（建议 20 LTS）"
}
$major = [int](& node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) { Fail ("Node.js 版本过低（当前 " + (& node -v) + "），需要 18+") }

if (Test-Path $Dest) {
  if (-not $Force) { Fail ($Dest + " 已存在。升级请加 -Force（会替换旧版本）") }
  Remove-Item $Dest -Recurse -Force
}
New-Item -ItemType Directory -Path $Dest -Force | Out-Null

Write-Host "复制中…"
& robocopy $Src $Dest /E /XD node_modules frames out stills qa /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Fail ("复制失败（robocopy 退出码 " + $LASTEXITCODE + "）") }

if (-not (Test-Path (Join-Path $Dest "SKILL.md"))) { Fail "安装后缺少 SKILL.md" }
if (-not (Test-Path (Join-Path $Dest "assets\template\render.js"))) { Fail "安装后模板不完整" }

$ver = "unknown"
$verFile = Join-Path $Dest "VERSION"
if (Test-Path $verFile) { $ver = (Get-Content $verFile -Raw).Trim() }

Write-Host ""
Write-Host ("brief-to-video " + $ver + " 已安装到: " + $Dest)
Write-Host ""
Write-Host "下一步:"
Write-Host "  1. 在 Qoder 会话里说：帮我做一个 30 秒的 ___ 宣传视频"
Write-Host ('     或手动建工程: node "' + (Join-Path $Dest "scripts\new-film.js") + '" .\my-film --title "标题"')
Write-Host "  2. cd 到工程目录后 npm install"
Write-Host "  3. node tools\doctor.js . ; npm run qa"
Write-Host ""
Write-Host "注意: 模板工程首次运行需要 npm install（puppeteer / ffmpeg 安装包）。"
Write-Host ("卸载: Remove-Item -Recurse -Force `"" + $Dest + "`"")
