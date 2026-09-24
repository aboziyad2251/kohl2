Add-Type -AssemblyName System.Drawing

$src = "public\Kohl-Logo-Transparent-Background@2x.png"
$bmp = New-Object System.Drawing.Bitmap($src)
$outBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.A -gt 15) {
            # Check if this pixel is the green emblem or the dark text
            # Green emblem has G significantly higher than R and B (e.g. G > R + 20 and G > B + 20)
            # Text is black/dark grey (R, G, B are all low and close to each other, e.g. R < 60, G < 60, B < 60)
            if ($p.G -gt ($p.R + 25) -and $p.G -gt ($p.B + 20)) {
                # Preserve the original green emblem pixel
                $outBmp.SetPixel($x, $y, $p)
            } else {
                # This is the text (black/dark grey). Change to bright white with matching alpha
                $newColor = [System.Drawing.Color]::FromArgb($p.A, 255, 255, 255)
                $outBmp.SetPixel($x, $y, $newColor)
            }
        } else {
            $outBmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}

$outBmp.Save("public\kohl-logo-white-text.png", [System.Drawing.Imaging.ImageFormat]::Png)
$outBmp.Dispose()
$bmp.Dispose()
Write-Output "Successfully generated kohl-logo-white-text.png"
