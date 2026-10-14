# Build script for the badminton court booking app (no Gradle)
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = "Stop"

$JAVA   = "E:\opt\java\jdk-17.0.12"
$AAPT2  = "E:\opt\android-sdk\build-tools\bin\aapt2.exe"
$PLAT   = "E:\opt\android-sdk\platforms\android-36\android.jar"
$PLAT17 = "E:\opt\android-sdk\platforms\android-36\android17.jar"
$BT     = "E:\opt\android-sdk\build-tools"
$PROJ   = "E:\opt\LMworkstation\badminton\app"
$KS     = "$BT\booking.keystore"
$PASS   = "booking2024"
$ALIAS  = "booking"
$OUT    = "E:\opt\LMworkstation\badminton\qiangchangdi.apk"

function Step($n, $msg) { Write-Host "`n=== Step ${n}: $msg ===" }

Step 1 "Clean"
Remove-Item -Force "$BT\compiled.zip","$BT\app-unsigned.apk","$BT\classes.dex" -EA SilentlyContinue
Remove-Item -Recurse -Force "$BT\classes","$BT\com" -EA SilentlyContinue

Step 2 "Compile resources"
& $AAPT2 compile --dir "$PROJ\res" -o "$BT\compiled.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Step 3 "Link resources + generate R.java + base APK"
& $AAPT2 link -o "$BT\app-unsigned.apk" -I $PLAT --manifest "$PROJ\AndroidManifest.xml" "$BT\compiled.zip" --min-sdk-version 28 --target-sdk-version 36 --java "$BT"
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

$RJAVA = "$BT\com\booking\court\R.java"
if (!(Test-Path $RJAVA)) { throw "R.java not found at $RJAVA" }

Step 4 "Compile Java sources"
New-Item -ItemType Directory -Force -Path "$BT\classes" | Out-Null
$srcFiles = (Get-ChildItem "$PROJ\src\com\booking\court" -Filter *.java | ForEach-Object { $_.FullName }) + $RJAVA
& "$JAVA\bin\javac.exe" -source 17 -target 17 -cp $PLAT17 -encoding UTF-8 -d "$BT\classes" $srcFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Step 5 "DEX compile (D8)"
$clsFiles = (Get-ChildItem "$BT\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName })
& "$JAVA\bin\java.exe" -cp "$BT\r8.jar" com.android.tools.r8.D8 --release --output "$BT" --lib $PLAT17 --min-api 28 $clsFiles
if ($LASTEXITCODE -ne 0) { throw "D8 failed" }
if (!(Test-Path "$BT\classes.dex")) { throw "classes.dex not generated" }

Step 6 "Add classes.dex to APK"
& "$JAVA\bin\jar.exe" uf "$BT\app-unsigned.apk" -C "$BT" "classes.dex"
if ($LASTEXITCODE -ne 0) { throw "jar update failed" }

Step 7 "Generate keystore (if missing)"
if (!(Test-Path $KS)) {
    & "$JAVA\bin\keytool.exe" -genkeypair -keystore $KS -storetype PKCS12 -storepass $PASS -keyalg RSA -keysize 2048 -validity 10000 -alias $ALIAS -dname "CN=Booking,O=Court,L=SH,ST=SH,C=CN"
    if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

Step 8 "Sign APK (apksig v2/v3 via SignApk wrapper)"
& "$JAVA\bin\java.exe" -cp "$BT\apksig.jar;$BT" SignApk $KS $PASS $ALIAS $PASS "$BT\app-unsigned.apk" $OUT
if ($LASTEXITCODE -ne 0) { throw "apksig signing failed" }

Step 9 "Verify signature"
& "$JAVA\bin\jarsigner.exe" -verify -verbose "$OUT" 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host $_ }

Write-Host "`n=== Build complete ==="
Write-Host ("Output: {0}" -f $OUT)
Write-Host ("Size: {0:N1} KB" -f ((Get-Item $OUT).Length / 1KB))
Write-Host "Install: adb install `"$OUT`" (or copy APK to phone)"
