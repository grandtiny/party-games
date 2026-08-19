$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not ("ManorAssetImageInspector" -as [type])) {
  $drawingReferences = @(
    [Drawing.Bitmap].Assembly.Location,
    [Drawing.Rectangle].Assembly.Location,
    (Join-Path $PSHOME "System.Private.Windows.Core.dll")
  )
  Add-Type -ReferencedAssemblies $drawingReferences -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public sealed class ManorAssetImageSummary
{
    public int Width { get; set; }
    public int Height { get; set; }
    public long VisiblePixels { get; set; }
    public int VisibleX { get; set; }
    public int VisibleY { get; set; }
    public int VisibleWidth { get; set; }
    public int VisibleHeight { get; set; }
}

public static class ManorAssetImageInspector
{
    public static ManorAssetImageSummary Inspect(string path)
    {
        using (Image source = Image.FromFile(path))
        using (Bitmap bitmap = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            using (Graphics graphics = Graphics.FromImage(bitmap))
            {
                graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                graphics.DrawImageUnscaled(source, 0, 0);
            }

            Rectangle rectangle = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
            BitmapData data = bitmap.LockBits(rectangle, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            try
            {
                int stride = Math.Abs(data.Stride);
                byte[] pixels = new byte[stride * bitmap.Height];
                Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

                int minX = bitmap.Width;
                int minY = bitmap.Height;
                int maxX = -1;
                int maxY = -1;
                long visiblePixels = 0;

                for (int y = 0; y < bitmap.Height; y++)
                {
                    int sourceY = data.Stride < 0 ? bitmap.Height - 1 - y : y;
                    int rowOffset = sourceY * stride;
                    for (int x = 0; x < bitmap.Width; x++)
                    {
                        if (pixels[rowOffset + (x * 4) + 3] == 0) continue;
                        visiblePixels++;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }

                return new ManorAssetImageSummary
                {
                    Width = bitmap.Width,
                    Height = bitmap.Height,
                    VisiblePixels = visiblePixels,
                    VisibleX = visiblePixels == 0 ? 0 : minX,
                    VisibleY = visiblePixels == 0 ? 0 : minY,
                    VisibleWidth = visiblePixels == 0 ? 0 : maxX - minX + 1,
                    VisibleHeight = visiblePixels == 0 ? 0 : maxY - minY + 1
                };
            }
            finally
            {
                bitmap.UnlockBits(data);
            }
        }
    }
}
"@
}

function Get-ManorAssetImageSummary([string]$Path) {
  return [ManorAssetImageInspector]::Inspect($Path)
}

function Get-ManorAssetHash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-ManorAssetRelativePath([string]$Root, [string]$Path) {
  return [IO.Path]::GetRelativePath($Root, $Path).Replace("\", "/")
}
