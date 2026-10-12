Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null
foreach ($icon in @(@{ Name = 'icon-192.png'; Size = 192 }, @{ Name = 'icon-512.png'; Size = 512 }, @{ Name = 'icon-maskable-512.png'; Size = 512 }, @{ Name = 'apple-touch-icon.png'; Size = 180 })) {
    $size = $icon.Size
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#345eae'))
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $mintBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#88c9ae'))
    $graphics.FillRectangle($whiteBrush, [single]($size * .27), [single]($size * .28), [single]($size * .46), [single]($size * .12))
    $graphics.FillRectangle($whiteBrush, [single]($size * .44), [single]($size * .38), [single]($size * .12), [single]($size * .35))
    $graphics.FillEllipse($mintBrush, [single]($size * .65), [single]($size * .64), [single]($size * .10), [single]($size * .10))
    $bitmap.Save((Join-Path $iconDirectory $icon.Name), [System.Drawing.Imaging.ImageFormat]::Png)
    $mintBrush.Dispose()
    $whiteBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
