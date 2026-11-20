# 安装便携版 Blender（story 的 CG 渲染引擎，Windows x64）。
# 解压到用户工具目录，不写系统路径；cg-render.js 会自动找到 %USERPROFILE%\.qoder\tools\blender\blender.exe。
# 用法:
#   powershell -ExecutionPolicy Bypass -File scripts\install-blender.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-blender.ps1 -Dest D:\tools\blender
#   powershell -ExecutionPolicy Bypass -File scripts\install-blender.ps1 -Version 5.3.0 -Force
param(
  [string]$Dest = (Join-Path $HOME ".qoder\tools\blender"),
  [string]$Version = "5.3.0",
  [string]$Mirror = "https://mirrors.aliyun.com/blender/release",
  [switch]$Force
)
$ErrorActionPreference = "Stop"

function Fail([string]$msg) { Write-Host ("错误: " + $msg) -ForegroundColor Red; exit 1 }

$Bin = Join-Path $Dest "blender.exe"
if ((Test-Path $Bin) -and (-not $Force)) {
  Write-Host ("已安装: " + $Bin)
  & $Bin --version | Select-Object -First 1
  Write-Host "要换版本加 -Force。"
  exit 0
}

$MajorMinor = $Version.Substring(0, $Version.LastIndexOf("."))
$Url = ($Mirror.TrimEnd("/") + "/Blender" + $MajorMinor + "/blender-" + $Version + "-windows-x64.zip")

Write-Host ("Blender " + $Version + "（Windows x64）")
Write-Host ("  来源  " + $Url)
Write-Host ("  目标  " + $Dest)
Write-Host ""

$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("blender-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Tmp -Force | Out-Null
$Zip = Join-Path $Tmp "blender.zip"
try {
  Write-Host "下载中…（约 400 MB，镜像快时几分钟）"
  if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe -fL --retry 3 --connect-timeout 20 -o $Zip $Url
    if ($LASTEXITCODE -ne 0) { Fail "下载失败。可换镜像: -Mirror https://download.blender.org/release" }
  } else {
    $ProgressPreference = "SilentlyContinue"
    try { Invoke-WebRequest -Uri $Url -OutFile $Zip } catch {
      Fail "下载失败。可换镜像: -Mirror https://download.blender.org/release"
    }
  }

  Write-Host "解压中…"
  Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
  $found = Get-ChildItem $Tmp -Filter blender.exe -Recurse | Select-Object -First 1
  if (-not $found) { Fail "zip 里没有 blender.exe，下载可能不完整" }

  New-Item -ItemType Directory -Path $Dest -Force | Out-Null
  Copy-Item -Path (Join-Path $found.Directory.FullName "*") -Destination $Dest -Recurse -Force
} finally {
  Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $Bin)) { Fail ("安装后找不到可执行文件: " + $Bin) }
& $Bin --version | Select-Object -First 1

Write-Host ""
Write-Host ("完成: " + $Bin)
Write-Host ""
Write-Host "下一步:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\fetch-cg-assets.ps1   # HDRI / PBR 素材（Poly Haven CC0）"
Write-Host "  工程里 config.js 写 engine: 'cg'，或临时指路径:"
Write-Host ('    node tools\cg-render.js --blender "' + $Bin + '"')
Write-Host ("  cg_kit 会自动找到 " + $Bin + "（也可用环境变量 BLENDER_BIN 覆盖）。")
