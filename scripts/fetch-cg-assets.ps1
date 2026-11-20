# 下载 CG 镜头用的真实素材（Poly Haven，CC0 公共领域，可商用）。
# 默认放 %USERPROFILE%\.qoder\tools\cg-library，cg_kit 的 film.py 按约定路径读取。
# 用法:
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-cg-assets.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-cg-assets.ps1 -Dest D:\cg-library
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-cg-assets.ps1 -Force   # 重新下载已有文件
param(
  [string]$Dest = (Join-Path $HOME ".qoder\tools\cg-library"),
  [switch]$Force
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Fail([string]$msg) { Write-Host ("错误: " + $msg) -ForegroundColor Red; exit 1 }

$HdriBase = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k"
$TexBase = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k"

function Fetch([string]$url, [string]$rel) {
  $out = Join-Path $Dest $rel
  if ((Test-Path $out) -and ((Get-Item $out).Length -gt 0) -and (-not $Force)) {
    Write-Host ("  已有  " + $rel)
    return
  }
  New-Item -ItemType Directory -Path (Split-Path -Parent $out) -Force | Out-Null
  Write-Host ("  下载  " + $rel)
  try {
    Invoke-WebRequest -Uri $url -OutFile ($out + ".part") -TimeoutSec 120
  } catch {
    Remove-Item ($out + ".part") -Force -ErrorAction SilentlyContinue
    Fail ("下载失败: " + $url)
  }
  Move-Item -Force ($out + ".part") $out
}

New-Item -ItemType Directory -Path $Dest -Force | Out-Null
Write-Host ("CG 素材 → " + $Dest)
Write-Host ""

Fetch "$HdriBase/cobblestone_street_night_2k.hdr" "hdri\cobblestone_street_night_2k.hdr"
Fetch "$TexBase/asphalt_04/asphalt_04_diff_1k.jpg" "pbr\asphalt_04\asphalt_04_diff_1k.jpg"
Fetch "$TexBase/asphalt_04/asphalt_04_rough_1k.jpg" "pbr\asphalt_04\asphalt_04_rough_1k.jpg"
Fetch "$TexBase/asphalt_04/asphalt_04_nor_gl_1k.jpg" "pbr\asphalt_04\asphalt_04_nor_gl_1k.jpg"
Fetch "$TexBase/asphalt_04/asphalt_04_ao_1k.jpg" "pbr\asphalt_04\asphalt_04_ao_1k.jpg"

$Lic = Join-Path $Dest "LICENSE.txt"
if (-not (Test-Path $Lic)) {
  @'
CG asset library — Poly Haven (https://polyhaven.com)
License: CC0 1.0 Universal (public domain). Free for commercial use, no attribution required.

  hdri/cobblestone_street_night_2k.hdr   — Poly Haven "cobblestone_street_night" (HDRI)
  pbr/asphalt_04/asphalt_04_*_1k.jpg     — Poly Haven "asphalt_04" (diffuse/rough/normal/AO)

Keep this file with the assets when copying them between machines.
'@ | Set-Content -Encoding UTF8 $Lic
}

Write-Host ""
Write-Host "完成。工程里 film.py 用 asset('hdri/…') / asset('pbr/…') 读取；"
Write-Host "素材放在别处时用环境变量 CG_ASSETS 指向素材根目录。"
$size = (Get-ChildItem $Dest -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("  当前占用 " + [math]::Round($size / 1MB, 1) + " MB")
