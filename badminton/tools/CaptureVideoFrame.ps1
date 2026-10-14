param(
    [Parameter(Mandatory = $true)][string]$Video,
    [Parameter(Mandatory = $true)][double]$Seconds,
    [Parameter(Mandatory = $true)][string]$Output
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$window = New-Object System.Windows.Window
$window.Width = 576
$window.Height = 1280
$window.WindowStyle = [System.Windows.WindowStyle]::None
$window.ResizeMode = [System.Windows.ResizeMode]::NoResize
$window.ShowInTaskbar = $false
$window.Topmost = $true
$window.WindowStartupLocation = [System.Windows.WindowStartupLocation]::Manual
$window.Left = 100
$window.Top = 50

$media = New-Object System.Windows.Controls.MediaElement
$media.Source = [Uri]::new($Video)
$media.LoadedBehavior = [System.Windows.Controls.MediaState]::Manual
$media.UnloadedBehavior = [System.Windows.Controls.MediaState]::Stop
$media.ScrubbingEnabled = $true
$media.Width = 576
$media.Height = 1280
$media.Stretch = [System.Windows.Media.Stretch]::Uniform
$window.Content = $media

$opened = $false
$failed = $false
$media.Add_MediaOpened({ $script:opened = $true })
$media.Add_MediaFailed({ $script:failed = $true })

$window.Show()
$media.Play()

$deadline = [DateTime]::UtcNow.AddSeconds(8)
while (-not $opened -and -not $failed -and [DateTime]::UtcNow -lt $deadline) {
    [System.Windows.Threading.Dispatcher]::CurrentDispatcher.Invoke(
        [System.Windows.Threading.DispatcherPriority]::Background,
        [Action]{ })
    Start-Sleep -Milliseconds 100
}

if ($failed) {
    $window.Close()
    throw 'MediaElement failed to open the video.'
}
if (-not $opened) {
    $window.Close()
    throw 'MediaElement did not open the video within 8 seconds.'
}

$media.Position = [TimeSpan]::FromSeconds($Seconds)
$media.Play()
Start-Sleep -Seconds 3

$origin = $media.PointToScreen([System.Windows.Point]::new(0, 0))
$bitmap = New-Object System.Drawing.Bitmap 576, 1280
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen([int]$origin.X, [int]$origin.Y, 0, 0, $bitmap.Size)
$graphics.Dispose()
$bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
$window.Close()
