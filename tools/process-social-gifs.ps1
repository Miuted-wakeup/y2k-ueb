<#
.SYNOPSIS
Creates the About social GIFs from the six original LineBoiler downloads.
.DESCRIPTION
Requires FFmpeg. Originals are never modified. Existing output files are refused;
use a separate -OutputDirectory to regenerate without overwriting manual work.
The source set is 368x368, four frames at 200ms each, looping forever.
Original frame equivalence is [0, 1, 2, 1]; the repeated fourth frame is retained.
Black/dark-gray keying removes both exterior and matching interior background.
GIF alpha is binary; original light-gray/white animated chalk lines are retained.
#>
[CmdletBinding()]
param(
    [string]$SourceDirectory = (Join-Path $env:USERPROFILE 'Downloads'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../assets/gifs/sobre-mi/social'),
    [string]$FfmpegPath = 'ffmpeg'
)

$ErrorActionPreference = 'Stop'
$assets = @(
    @{ Source = 'ai-lineboiler.gif'; Target = 'instagram.gif'; Key = '0x000000'; SHA256 = '2ef2a0ce19b9e0bdeb5f20cf79b5f0d5a479b66a29f131ac99109f67c5983141' },
    @{ Source = 'a-lineboiler.gif'; Target = 'youtube.gif'; Key = '0x000000'; SHA256 = '5393d799e5b514fdcae0f3c8ceecc02d447b96642665e0579ebc016994f97cee' },
    @{ Source = 'e-lineboiler.gif'; Target = 'twitter.gif'; Key = '0x000000'; SHA256 = 'da9a28ca4c4bc83a5630c59ee9159599039d65e8180794534b9499b7160b2307' },
    @{ Source = 'u-lineboiler.gif'; Target = 'pinterest.gif'; Key = '0x000000'; SHA256 = '891eb21137ad46b62e8e512d9b5d9001e881012728b947867fab6bd9f2e24b50' },
    @{ Source = 'b-lineboiler.gif'; Target = 'spotify.gif'; Key = '0x242424'; SHA256 = 'ea0a98dc2e5fbf06c76295621fbc5ea8f1ff33bd08dcdd8a96513cfab669cd89' },
    @{ Source = 'c-lineboiler.gif'; Target = 'tiktok.gif'; Key = '0x000000'; SHA256 = 'e66da3287651859fb6c02bc0f172e5b73f448aa3b839b0f4eeda4d4b4e4234cc' }
)

$null = Get-Command $FfmpegPath -ErrorAction Stop
foreach ($asset in $assets) {
    $source = Join-Path $SourceDirectory $asset.Source
    $target = Join-Path $OutputDirectory $asset.Target
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing input: $source" }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.SHA256) {
        throw "Source differs from the verified LineBoiler original: $source"
    }
    if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite: $target" }
}
$null = New-Item -ItemType Directory -Path $OutputDirectory -Force

foreach ($asset in $assets) {
    $source = Join-Path $SourceDirectory $asset.Source
    $target = Join-Path $OutputDirectory $asset.Target
    $filter = "[0:v]format=rgba,colorkey=$($asset.Key):0.08:0,scale=128:128:flags=lanczos,split[colors][paletteSource];[paletteSource]palettegen=reserve_transparent=1:stats_mode=full[palette];[colors][palette]paletteuse=dither=0:alpha_threshold=128[out]"
    & $FfmpegPath -hide_banner -loglevel error -nostdin -n -ignore_loop 1 -i $source `
        -filter_complex_threads 1 -filter_complex $filter -map '[out]' `
        -fps_mode passthrough -gifflags '-offsetting-transdiff' -loop 0 -final_delay 20 $target
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed for $($asset.Source) (exit $LASTEXITCODE)" }
    Write-Output "Created $target"
}
