param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectUrl,

    [Parameter(Mandatory = $true)]
    [string]$ServiceRoleKey,

    [Parameter(Mandatory = $true)]
    [string]$FolderPath,

    [string]$Bucket = "cold",

    [string]$Prefix = "fotos_personal"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $FolderPath)) {
    throw "FolderPath does not exist: $FolderPath"
}

$files = Get-ChildItem -Path $FolderPath -File
if ($files.Count -eq 0) {
    throw "No files found in folder: $FolderPath"
}

$baseUrl = $ProjectUrl.TrimEnd('/')
$headers = @{
    "apikey" = $ServiceRoleKey
    "Authorization" = "Bearer $ServiceRoleKey"
    "x-upsert" = "true"
}

$ok = 0
$failed = 0

function Encode-ObjectPath([string]$PathValue) {
    $parts = $PathValue -split '/'
    $encoded = $parts | ForEach-Object { [System.Uri]::EscapeDataString($_) }
    return ($encoded -join '/')
}

$cleanPrefix = ""
if ($null -ne $Prefix) {
    $cleanPrefix = $Prefix.Trim().Trim('/')
}

if ([string]::IsNullOrWhiteSpace($cleanPrefix)) {
    Write-Host "Uploading $($files.Count) files to bucket '$Bucket' root..."
}
else {
    Write-Host "Uploading $($files.Count) files to bucket '$Bucket/$cleanPrefix'..."
}

foreach ($file in $files) {
    try {
        $objectPath = if ([string]::IsNullOrWhiteSpace($cleanPrefix)) { $file.Name } else { "$cleanPrefix/$($file.Name)" }
        $encodedPath = Encode-ObjectPath $objectPath
        $uploadUrl = "$baseUrl/storage/v1/object/$Bucket/$encodedPath"

        Invoke-RestMethod `
            -Method Post `
            -Uri $uploadUrl `
            -Headers $headers `
            -ContentType "application/octet-stream" `
            -InFile $file.FullName | Out-Null

        $ok++
        Write-Host "OK    $objectPath"
    }
    catch {
        $failed++
        Write-Host "FAIL  $($file.Name) -> $($_.Exception.Message)"
    }
}

Write-Host "Done. Uploaded: $ok | Failed: $failed"
if ($failed -gt 0) {
    exit 1
}
