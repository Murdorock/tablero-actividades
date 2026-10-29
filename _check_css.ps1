$c = Get-Content -Raw .\styles.css
$o = ([regex]::Matches($c, '\{')).Count
$cl = ([regex]::Matches($c, '\}')).Count
Write-Host "Abren: $o  Cierran: $cl  Balance: $($o - $cl)"

# Detectar posibles propiedades problemáticas repetidas dentro de una misma regla no es trivial;
# reportamos duplicados de selectores exactos.
$selectors = [regex]::Matches($c, '(?m)^([^\s{][^{}]*)\{') | ForEach-Object { $_.Groups[1].Value.Trim() }
$dup = $selectors | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dup) {
    Write-Host "`nSelectores duplicados:"
    $dup | ForEach-Object { Write-Host ("  [" + $_.Count + "x] " + $_.Name) }
} else {
    Write-Host "`nSin selectores duplicados."
}
