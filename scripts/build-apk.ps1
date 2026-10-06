param(
    [string]$JavaHome,
    [string]$AndroidSdk = "$env:LOCALAPPDATA/Android/Sdk",
    [switch]$SkipPrebuild,
    [string]$Architectures = 'arm64-v8a,armeabi-v7a,x86_64'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if (-not $JavaHome) {
    $portable = Get-ChildItem -LiteralPath "$root/.build-tools/jdk17" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    $JavaHome = if ($portable) { $portable.FullName } else { $env:JAVA_HOME }
}
if (-not $JavaHome -or -not (Test-Path -LiteralPath "$JavaHome/bin/java.exe")) { throw 'JDK 17 required. Pass -JavaHome with its directory.' }
if (-not (Test-Path -LiteralPath $AndroidSdk)) { throw 'Android SDK not found. Pass -AndroidSdk with its directory.' }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:PATH = "$JavaHome/bin;$AndroidSdk/platform-tools;$env:PATH"
$env:NODE_ENV = 'production'

$credentialDir = Join-Path $root '.credentials'
New-Item -ItemType Directory -Force -Path $credentialDir | Out-Null
$credentialFile = Join-Path $credentialDir 'signing.json'
if (-not (Test-Path -LiteralPath $credentialFile)) {
    $password = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    @{ storePassword = $password; keyPassword = $password; alias = 'svoi' } | ConvertTo-Json | Set-Content -LiteralPath $credentialFile -Encoding utf8
}
$credentials = Get-Content -LiteralPath $credentialFile -Raw | ConvertFrom-Json
$env:SVOI_KEYSTORE = Join-Path $credentialDir 'svoi-video.jks'
$env:SVOI_STORE_PASSWORD = $credentials.storePassword
$env:SVOI_KEY_PASSWORD = $credentials.keyPassword
$env:SVOI_KEY_ALIAS = $credentials.alias

try {
    if (-not (Test-Path -LiteralPath $env:SVOI_KEYSTORE)) {
        & "$JavaHome/bin/keytool.exe" -genkeypair -v -keystore $env:SVOI_KEYSTORE -storepass:env SVOI_STORE_PASSWORD -keypass:env SVOI_KEY_PASSWORD -alias $env:SVOI_KEY_ALIAS -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Svoi Video, OU=Personal, O=Local, C=RU' -storetype JKS
        if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed' }
    }
    if (-not $SkipPrebuild) {
        & npx.cmd expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed' }
    }
    "sdk.dir=$($AndroidSdk.Replace('\', '/'))" | Set-Content -LiteralPath 'android/local.properties' -Encoding ascii
    Push-Location -LiteralPath "$root/android"
    try {
        & ./gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=$Architectures" '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m' --max-workers=4 --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed' }
    } finally { Pop-Location }
    New-Item -ItemType Directory -Force -Path "$root/artifacts" | Out-Null
    $appVersion = (Get-Content -LiteralPath "$root/app.json" -Raw | ConvertFrom-Json).expo.version
    $apkName = "svoi-video-$appVersion.apk"
    $apk = "$root/artifacts/$apkName"
    Copy-Item -LiteralPath "$root/android/app/build/outputs/apk/release/app-release.apk" -Destination $apk -Force
    $hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLower()
    "$hash  $apkName" | Set-Content -LiteralPath "$apk.sha256" -Encoding ascii
    Write-Output "APK: $apk"
    Write-Output "SHA256: $hash"
} finally {
    Remove-Item Env:SVOI_STORE_PASSWORD, Env:SVOI_KEY_PASSWORD, Env:SVOI_KEY_ALIAS, Env:SVOI_KEYSTORE -ErrorAction SilentlyContinue
}
