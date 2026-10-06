$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot

foreach ($transparent in @($false, $true)) {
    $bitmap = [System.Drawing.Bitmap]::new(1024, 1024)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear($(if ($transparent) { [System.Drawing.Color]::Transparent } else { [System.Drawing.ColorTranslator]::FromHtml('#17233D') }))
    $outline = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#B9CCFF'), 23)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc(306, 254, 100, 100, 180, 90)
    $path.AddArc(618, 254, 100, 100, 270, 90)
    $path.AddArc(618, 670, 100, 100, 0, 90)
    $path.AddArc(306, 670, 100, 100, 90, 90)
    $path.CloseFigure()
    $graphics.DrawPath($outline, $path)
    $triangle = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(455, 414), [System.Drawing.PointF]::new(455, 610), [System.Drawing.PointF]::new(605, 512))
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $graphics.FillPolygon($brush, $triangle)
    $filename = if ($transparent) { 'app-icon-foreground.png' } else { 'app-icon.png' }
    $bitmap.Save((Join-Path $root "assets/images/$filename"), [System.Drawing.Imaging.ImageFormat]::Png)
    $brush.Dispose()
    $path.Dispose()
    $outline.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
