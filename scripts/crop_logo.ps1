Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\..\..\..\..\..\..\Desktop\logos files -20260905T003337Z-1-001\logos files\kohl_logo_package\Kohl-Logo-Transparent-Background@2x.png"
if (-not (Test-Path $srcPath)) {
    $srcPath = "public\Kohl-Logo-Transparent-Background@2x.png"
}

$bmp = New-Object System.Drawing.Bitmap($srcPath)
$width = $bmp.Width
$height = $bmp.Height

Write-Output "Image Dimensions: $width x $height"

# Find bounds of the left emblem (green roof and house)
# Scan columns from left to right. Once there is a gap of empty columns, that separates emblem from text!
$columnHasPixel = New-Object bool[] $width

for ($x = 0; $x -lt $width; $x++) {
    $hasPixel = $false
    for ($y = 0; $y -lt $height; $y++) {
        $pixel = $bmp.GetPixel($x, $y)
        if ($pixel.A -gt 20) {
            $hasPixel = $true
            break
        }
    }
    $columnHasPixel[$x] = $hasPixel
}

# Find emblem end: first sequence of non-empty columns, then an empty column gap
$emblemStart = -1
$emblemEnd = -1
for ($x = 0; $x -lt $width; $x++) {
    if ($columnHasPixel[$x] -and $emblemStart -eq -1) {
        $emblemStart = $x
    }
    if ($emblemStart -ne -1 -and (-not $columnHasPixel[$x])) {
        # Check if next 5 columns are also empty (true gap)
        $isGap = $true
        for ($k = 1; $k -le 10; $k++) {
            if ($x + $k -lt $width -and $columnHasPixel[$x + $k]) {
                $isGap = $false
                break
            }
        }
        if ($isGap) {
            $emblemEnd = $x
            break
        }
    }
}

Write-Output "Emblem X Bounds: $emblemStart to $emblemEnd"

# Find emblem Y bounds
$minY = $height
$maxY = 0
for ($x = $emblemStart; $x -le $emblemEnd; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.A -gt 20) {
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Emblem Y Bounds: $minY to $maxY"

$cropW = $emblemEnd - $emblemStart
$cropH = $maxY - $minY
Write-Output "Emblem Size: $cropW x $cropH"

# Create cropped emblem square bitmap with padding
$maxDim = [Math]::Max($cropW, $cropH)
$padding = [int]($maxDim * 0.08)
$targetSize = $maxDim + ($padding * 2)

$emblemBmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($emblemBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$destX = $padding + [int](($maxDim - $cropW) / 2)
$destY = $padding + [int](($maxDim - $cropH) / 2)

$srcRect = New-Object System.Drawing.Rectangle($emblemStart, $minY, $cropW, $cropH)
$destRect = New-Object System.Drawing.Rectangle($destX, $destY, $cropW, $cropH)

$g.DrawImage($bmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$emblemBmp.Save("public\kohl-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$emblemBmp.Save("public\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$emblemBmp.Save("public\favicon.ico", [System.Drawing.Imaging.ImageFormat]::Icon)
if (-not (Test-Path "app")) { New-Item -ItemType Directory -Path "app" }
$emblemBmp.Save("app\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$emblemBmp.Save("app\favicon.ico", [System.Drawing.Imaging.ImageFormat]::Icon)

$g.Dispose()
$emblemBmp.Dispose()
$bmp.Dispose()
Write-Output "Successfully generated kohl-icon.png, favicon.png, favicon.ico, app/icon.png!"
