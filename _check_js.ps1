$c = Get-Content -Raw .\table-logic-generador_rutas.js
$o = ([regex]::Matches($c, '\{')).Count
$cl = ([regex]::Matches($c, '\}')).Count
$po = ([regex]::Matches($c, '\(')).Count
$pc = ([regex]::Matches($c, '\)')).Count
Write-Host "Llaves: abre $o cierra $cl (balance $($o - $cl))"
Write-Host "Parentesis: abre $po cierra $pc (balance $($po - $pc))"
