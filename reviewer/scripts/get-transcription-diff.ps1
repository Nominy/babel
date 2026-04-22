$BaseUrl = "https://dashboard.babel.audio/api/trpc/transcriptions.getTranscriptionDiff"
$Batch = 1
$ReferenceReviewActionId = "de5a57df-e1ef-4dbb-adc6-54b505a9251f"
$CurrentReviewActionId = "010cce71-b7ae-4226-88de-4683982b8325"
$CookieFile = "C:\Users\User\Desktop\dev\babel\reviewer\cookies.txt"
$OutputFile = "C:\Users\User\Desktop\dev\babel\reviewer\transcription-diff-response.json"
$HeaderFile = "C:\Users\User\Desktop\dev\babel\reviewer\transcription-diff-headers.txt"
$IncludeResponseHeadersInOutput = $false

# Optional raw cookie header. Leave empty to use CookieFile.
# Example: "__session=...; __client_uat=...;"
$CookieHeader = ""

$inputJson = [string]::Format(
    '{{"0":{{"json":{{"referenceReviewActionId":"{0}","currentReviewActionId":"{1}"}}}}}}',
    $ReferenceReviewActionId,
    $CurrentReviewActionId
)
$inputEncoded = [uri]::EscapeDataString($inputJson)
$url = "${BaseUrl}?batch=$Batch&input=$inputEncoded"

Write-Host "Request URL:"
Write-Host $url
Write-Host ""

# Equivalent curl:
# curl.exe -sS "$url" -H "Accept: application/json" -b "$CookieFile" -o "$OutputFile"
# or:
# curl.exe -sS "$url" -H "Accept: application/json" -H "Cookie: $CookieHeader" -o "$OutputFile"

$curlArgs = @("-sS", $url, "-H", "Accept: application/json", "-o", $OutputFile, "-D", $HeaderFile, "-w", "HTTP_STATUS:%{http_code}")
if ($IncludeResponseHeadersInOutput) {
    $curlArgs += "-i"
}
if ($CookieHeader -ne "") {
    $curlArgs += @("-H", "Cookie: $CookieHeader")
} elseif ($CookieFile -ne "" -and (Test-Path $CookieFile)) {
    $curlArgs += @("-b", $CookieFile)
} else {
    Write-Warning "No CookieHeader set and CookieFile not found. Request may fail with auth error."
}

Write-Host "Executing curl..."
$statusLine = curl.exe @curlArgs
Write-Host $statusLine
if ($LASTEXITCODE -eq 0) {
    if (Test-Path $OutputFile) {
        $sizeBytes = (Get-Item $OutputFile).Length
        Write-Host "Saved response to: $OutputFile ($sizeBytes bytes)"
    } else {
        Write-Warning "curl succeeded but output file was not found: $OutputFile"
    }
    if (Test-Path $HeaderFile) {
        Write-Host "Saved response headers to: $HeaderFile"
    }
}
