# Builds icon.ico from folio.svg's geometry.
#
# Why not `tauri icon`: it PNG-compresses every layer. Windows only decodes
# PNG-compressed icon entries at 256x256 when loading them out of an exe's
# resource table, so Explorer/Start/Open-with can't read the 16-64px layers and
# fall back to the generic application placeholder. Small sizes must be DIBs.
#
# Run from this directory:  powershell -ExecutionPolicy Bypass -File make-ico.ps1

Add-Type -AssemblyName System.Drawing

$BG = [System.Drawing.ColorTranslator]::FromHtml('#A6321B')
$FG = [System.Drawing.ColorTranslator]::FromHtml('#EEEDE7')
# folio.svg: "M128 104h256v54H190v83h160v52H190v115h-62z" on a 512 viewBox
$F = @(@(128,104), @(384,104), @(384,158), @(190,158), @(190,241),
       @(350,241), @(350,293), @(190,293), @(190,408), @(128,408))

function Render([int]$s) {
  $b = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear($BG)
  $k = $s / 512.0
  $pts = $F | ForEach-Object { New-Object System.Drawing.PointF ([float]($_[0]*$k)), ([float]($_[1]*$k)) }
  $g.FillPolygon((New-Object System.Drawing.SolidBrush $FG), [System.Drawing.PointF[]]$pts)
  $g.Dispose()
  $b
}

# 32bpp bottom-up DIB + all-zero AND mask, the format shell32 expects in RT_ICON
function ToDib($bmp) {
  $s = $bmp.Width
  $ms = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter $ms
  $w.Write([uint32]40); $w.Write([int32]$s); $w.Write([int32]($s*2))
  $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]0)
  $w.Write([uint32]0); $w.Write([int32]0); $w.Write([int32]0)
  $w.Write([uint32]0); $w.Write([uint32]0)
  for ($y = $s - 1; $y -ge 0; $y--) {
    for ($x = 0; $x -lt $s; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $w.Write([byte]$c.B); $w.Write([byte]$c.G); $w.Write([byte]$c.R); $w.Write([byte]$c.A)
    }
  }
  $stride = [Math]::Ceiling($s / 8.0)
  if ($stride % 4) { $stride += 4 - ($stride % 4) }
  $w.Write((New-Object byte[] ($stride * $s)))
  $w.Flush()
  # comma keeps PowerShell from unrolling the byte[] into the pipeline
  ,$ms.ToArray()
}

function ToPng($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  ,$ms.ToArray()
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$blobs = @()
foreach ($s in $sizes) {
  $bmp = Render $s
  # 256 stays PNG: shell32 handles it there, and a 256px DIB costs 256 KB
  if ($s -eq 256) { $data = ToPng $bmp } else { $data = ToDib $bmp }
  $blobs += [pscustomobject]@{ Size = $s; Data = $data }
  $bmp.Dispose()
}

$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$blobs.Count)
$offset = 6 + 16 * $blobs.Count
foreach ($e in $blobs) {
  $s = $e.Size; $d = $e.Data
  $w.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
  $w.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
  $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32)
  $w.Write([uint32]$d.Length); $w.Write([uint32]$offset)
  $offset += $d.Length
}
foreach ($e in $blobs) { $w.Write([byte[]]$e.Data) }
$w.Flush()

$dest = Join-Path $PSScriptRoot 'icon.ico'
[System.IO.File]::WriteAllBytes($dest, $out.ToArray())
"wrote $dest ({0} bytes, {1} layers)" -f (Get-Item $dest).Length, $blobs.Count
