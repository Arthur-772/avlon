param([string]$FramePath = 'E:\opt\LMworkstation\badminton\tools\frames\frame_01.png')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) {
    $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    $task.Result
}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($FramePath)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
'decoder=' + ($null -ne $decoder)
'software=' + ($null -ne $decoder.SoftwareBitmap)
if ($decoder.SoftwareBitmap) { 'size=' + $decoder.SoftwareBitmap.PixelWidth + 'x' + $decoder.SoftwareBitmap.PixelHeight }
$methods = $decoder.GetType().GetMethods() | Where-Object { $_.Name -match 'SoftwareBitmap' } | Select-Object -ExpandProperty Name
'methods=' + ($methods -join ',')
