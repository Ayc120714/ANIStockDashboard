# Quick page walkthrough on Android emulator (requires logged-in session)
$ErrorActionPreference = 'Stop'

function Get-UiTexts {
  adb shell uiautomator dump /sdcard/ui.xml 2>$null | Out-Null
  cmd /c "adb pull /sdcard/ui.xml `"$env:TEMP\ui-walk.xml`" >nul 2>&1"
  [xml]$x = Get-Content $env:TEMP\ui-walk.xml
  $texts = New-Object System.Collections.Generic.HashSet[string]
  function Walk($n) {
    foreach ($c in $n.ChildNodes) {
      $t = [string]$c.text
      if ($t -and $t.Length -lt 60 -and $t -notmatch '^\s*$') { [void]$texts.Add($t) }
      Walk $c
    }
  }
  Walk $x.hierarchy.node
  return ,$texts
}

function Tap($x, $y) {
  adb shell input tap $x $y | Out-Null
  Start-Sleep -Seconds 3
}

function HasAny($texts, [string[]]$needles) {
  foreach ($n in $needles) {
    foreach ($t in $texts) {
      if ($t -like "*$n*") { return $true }
    }
  }
  return $false
}

$results = @()

function Check($name, [string[]]$needles, [scriptblock]$action) {
  & $action
  $texts = Get-UiTexts
  $ok = HasAny $texts $needles
  $sample = ($texts | Select-Object -First 8) -join ' | '
  $results += [pscustomobject]@{ Page = $name; Status = $(if ($ok) { 'PASS' } else { 'FAIL' }); Sample = $sample }
  Write-Output "$(if ($ok){'PASS'}else{'FAIL'}) $name"
}

Check 'Dashboard tab' @('MARKET OVERVIEW','Dashboard') { Tap 135 1794 }
Check 'Stocks tab' @('Stocks','Overview','Market insights') { Tap 405 1794 }
Check 'Screens tab' @('Screens','AI picks','Trending') { Tap 675 1794 }
Check 'Advisor tab' @('Advisor','Signals','Trend reversal') { Tap 945 1794 }

# Hamburger menu (top-left menu icon ~48,120)
Tap 48 120
$menuTexts = Get-UiTexts
$menuOk = HasAny $menuTexts @('Portfolio Manager','Markets','Alerts','Settings')
$results += [pscustomobject]@{ Page = 'Hamburger menu'; Status = $(if ($menuOk) { 'PASS' } else { 'FAIL' }); Sample = (($menuTexts | Select-Object -First 10) -join ' | ') }
Write-Output "$(if ($menuOk){'PASS'}else{'FAIL'}) Hamburger menu"

if ($menuOk) {
  # Tap Markets sub-item - need coordinates from menu
  [xml]$mx = Get-Content $env:TEMP\ui-walk.xml
  function FindText($n, $label) {
    foreach ($c in $n.ChildNodes) {
      if ($c.text -eq $label -and $c.bounds) { return $c.bounds }
      $r = FindText $c $label
      if ($r) { return $r }
    }
  }
  $b = FindText $mx.hierarchy.node 'Markets'
  if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
    $cx = ([int]$Matches[1] + [int]$Matches[3]) / 2
    $cy = ([int]$Matches[2] + [int]$Matches[4]) / 2
    Tap $cx $cy
    $texts = Get-UiTexts
    $ok = HasAny $texts @('Overview','Market Insights','Sector Insights')
    $results += [pscustomobject]@{ Page = 'Markets (menu)'; Status = $(if ($ok) { 'PASS' } else { 'FAIL' }); Sample = (($texts | Select-Object -First 8) -join ' | ') }
    Write-Output "$(if ($ok){'PASS'}else{'FAIL'}) Markets (menu)"
  }
}

Write-Output "`n--- Summary ---"
$results | Format-Table -AutoSize
