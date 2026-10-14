Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime] | Out-Null
$lang = [Windows.Globalization.Language]::new('zh-Hans-CN')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
'engine null=' + ($null -eq $engine)
if ($engine) {
    'type=' + $engine.GetType().FullName
    $engine.GetType().GetMethods() | Where-Object { $_.Name -eq 'ExtractTextAsync' } | ForEach-Object { $_.Name + ' -> ' + $_.ReturnType.FullName }
}
