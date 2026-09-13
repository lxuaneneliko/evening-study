const { execFile } = require('node:child_process');
const path = require('node:path');

// Use Windows' built-in media session API, targeting Spotify specifically.
// No Spotify tokens, Premium Web API, global media-key toggles or downloaded helper.
function scriptFor(action) {
  if (!['status', 'play', 'pause'].includes(action)) throw new Error('不支援的 Spotify 操作。');
  return String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
  $propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
  $taskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Length -eq 1 -and $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name.StartsWith('IAsyncOperation') } | Select-Object -First 1
  function Await-Media($operation, [Type]$resultType) {
    $task = $taskMethod.MakeGenericMethod($resultType).Invoke($null, @($operation))
    if (-not $task.Wait(5000)) { throw 'Windows media control timed out' }
    return $task.Result
  }
  $manager = Await-Media ($managerType::RequestAsync()) $managerType
  $session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match 'spotify' } | Select-Object -First 1
  if ($null -eq $session) {
    @{ok=$false; code='NO_SESSION'; playing=$false} | ConvertTo-Json -Compress
  } else {
    $action = '${action}'
    $accepted = $true
    $wasPlaying = [string]$session.GetPlaybackInfo().PlaybackStatus -eq 'Playing'
    if ($action -eq 'play' -and -not $wasPlaying) { $accepted = Await-Media ($session.TryPlayAsync()) ([bool]) }
    if ($action -eq 'pause' -and $wasPlaying) { $accepted = Await-Media ($session.TryPauseAsync()) ([bool]) }
    if ($action -ne 'status') {
      for ($i=0; $i -lt 8; $i++) {
        $playing = [string]$session.GetPlaybackInfo().PlaybackStatus -eq 'Playing'
        if (($action -eq 'play' -and $playing) -or ($action -eq 'pause' -and -not $playing)) { break }
        Start-Sleep -Milliseconds 150
      }
    }
    $info = $session.GetPlaybackInfo()
    $media = Await-Media ($session.TryGetMediaPropertiesAsync()) $propertiesType
    @{ok=$true; accepted=[bool]$accepted; playing=([string]$info.PlaybackStatus -eq 'Playing'); status=[string]$info.PlaybackStatus; source=$session.SourceAppUserModelId; title=[string]$media.Title; artist=[string]$media.Artist; canPlay=[bool]$info.Controls.IsPlayEnabled; canPause=[bool]$info.Controls.IsPauseEnabled} | ConvertTo-Json -Compress
  }
} catch {
  @{ok=$false; code='MEDIA_UNAVAILABLE'; message=$_.Exception.Message; playing=$false} | ConvertTo-Json -Compress
}`;
}
function command(action = 'status', runner = execFile) {
  const script = scriptFor(action);
  const executable = path.join(process.env.WINDIR || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return new Promise(resolve => {
    runner(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, encoding: 'utf8', timeout: 12000, maxBuffer: 128 * 1024 }, (error, stdout) => {
      if (error) { resolve({ ok: false, code: 'MEDIA_UNAVAILABLE', playing: false }); return; }
      try {
        const result = JSON.parse(stdout.trim().replace(/^\uFEFF/, ''));
        if (typeof result.ok !== 'boolean' || typeof result.playing !== 'boolean') throw new Error('Invalid response');
        resolve(result);
      } catch { resolve({ ok: false, code: 'MEDIA_UNAVAILABLE', playing: false }); }
    });
  });
}
module.exports = { command, scriptFor };
