$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$temporaryDirectory = Join-Path $workspace "tmp"
$scssSource = Join-Path $workspace "assets\css\main.scss"
$heldScss = Join-Path $temporaryDirectory "main.scss.build-hold"
$generatedCss = Join-Path $workspace "_site\assets\css\main.css"
$heldCss = Join-Path $temporaryDirectory "main.css.build-hold"
$rubyBin = "C:\Ruby33-x64\bin"

if (-not (Test-Path -LiteralPath (Join-Path $rubyBin "ruby.exe"))) {
    throw "Ruby 3.3 was not found at $rubyBin."
}

New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null

$hasExistingCss = Test-Path -LiteralPath $generatedCss
if ($hasExistingCss) {
    Copy-Item -LiteralPath $generatedCss -Destination $heldCss -Force
}

Move-Item -LiteralPath $scssSource -Destination $heldScss -Force
try {
    $env:Path = "$rubyBin;$env:Path"
    Push-Location $workspace
    try {
        & bundle.bat exec jekyll build --config _config.yml,_config.dev.yml
        if ($LASTEXITCODE -ne 0) {
            throw "Jekyll exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Move-Item -LiteralPath $heldScss -Destination $scssSource -Force

    if ($hasExistingCss -and (Test-Path -LiteralPath $heldCss)) {
        New-Item -ItemType Directory -Path (Split-Path $generatedCss) -Force | Out-Null
        Copy-Item -LiteralPath $heldCss -Destination $generatedCss -Force
        Remove-Item -LiteralPath $heldCss
    }
}

