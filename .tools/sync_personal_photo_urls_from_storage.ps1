param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectUrl,

    [Parameter(Mandatory = $true)]
    [string]$ServiceRoleKey,

    [string]$Bucket = "cold",
    [string]$Prefix = "fotos_personal",
    [int]$PageSize = 100
)

$ErrorActionPreference = "Stop"

$baseUrl = $ProjectUrl.TrimEnd('/')
$headers = @{
    "apikey" = $ServiceRoleKey
    "Authorization" = "Bearer $ServiceRoleKey"
    "Content-Type" = "application/json"
}

function Get-ListBodyJson([string]$prefix, [int]$limit, [int]$offset) {
    $body = @{
        prefix = $prefix
        limit = $limit
        offset = $offset
    }
    return ($body | ConvertTo-Json)
}

function Normalize-Code([string]$fileName) {
    if ([string]::IsNullOrWhiteSpace($fileName)) { return $null }
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
    if ([string]::IsNullOrWhiteSpace($baseName)) { return $null }
    # Keep only known-safe chars and normalize case.
    return ($baseName.Trim().ToUpper())
}

$allObjects = @()
$offset = 0

while ($true) {
    $listUrl = "$baseUrl/storage/v1/object/list/$Bucket"
    $listBody = Get-ListBodyJson -prefix $Prefix -limit $PageSize -offset $offset
    $batch = Invoke-RestMethod -Method Post -Uri $listUrl -Headers $headers -Body $listBody

    if ($null -eq $batch -or $batch.Count -eq 0) {
        break
    }

    $allObjects += $batch

    if ($batch.Count -lt $PageSize) {
        break
    }

    $offset += $PageSize
}

if ($allObjects.Count -eq 0) {
    throw "No objects found in $Bucket/$Prefix"
}

# Build latest file per code. If duplicates exist, prefer latest updated_at.
$byCode = @{}
foreach ($obj in $allObjects) {
    $name = [string]$obj.name
    if ($name -eq ".emptyFolderPlaceholder") { continue }

    $code = Normalize-Code -fileName $name
    if ([string]::IsNullOrWhiteSpace($code)) { continue }

    $existing = $byCode[$code]
    if ($null -eq $existing) {
        $byCode[$code] = $obj
        continue
    }

    $existingUpdated = [datetime]$existing.updated_at
    $newUpdated = [datetime]$obj.updated_at
    if ($newUpdated -gt $existingUpdated) {
        $byCode[$code] = $obj
    }
}

$updated = 0
$notFound = 0
$failed = 0

foreach ($entry in $byCode.GetEnumerator()) {
    $code = [string]$entry.Key
    $fileName = [string]$entry.Value.name

    $encodedName = [System.Uri]::EscapeDataString($fileName)
    $publicUrl = "$baseUrl/storage/v1/object/public/$Bucket/$Prefix/$encodedName"

    $patchUrl = "$baseUrl/rest/v1/personal?id_codigo=eq.$code"
    $patchBody = @{ foto_url = $publicUrl } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Method Patch -Uri $patchUrl -Headers $headers -Body $patchBody
        # PostgREST PATCH often returns empty body when no representation requested.
        # Verify existence quickly.
        $checkUrl = "$baseUrl/rest/v1/personal?select=id_codigo&id_codigo=eq.$code&limit=1"
        $check = Invoke-RestMethod -Method Get -Uri $checkUrl -Headers $headers

        if ($null -eq $check -or $check.Count -eq 0) {
            $notFound++
            Write-Host "NO MATCH  $code"
            continue
        }

        $updated++
        Write-Host "UPDATED   $code"
    }
    catch {
        $failed++
        Write-Host "FAILED    $code -> $($_.Exception.Message)"
    }
}

Write-Host "Done. Updated: $updated | No match: $notFound | Failed: $failed"
if ($failed -gt 0) {
    exit 1
}
