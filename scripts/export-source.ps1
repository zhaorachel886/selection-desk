$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRelease = [System.IO.Path]::GetFullPath((Join-Path $taskRoot 'release'))
if (-not $taskRelease.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Invalid release directory' }
[System.IO.Directory]::CreateDirectory($taskRelease) | Out-Null
$taskVersion = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
$taskOutput = Join-Path $taskRelease "Selection-Desk-$taskVersion-source.zip"
$taskAllowed = @('.github', '.gitignore', 'AGENTS.md', 'README.md', 'README.en.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'src', 'tests', 'scripts', 'docs', 'connectors')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskStream = [System.IO.File]::Open($taskOutput, [System.IO.FileMode]::Create)
$taskArchive = [System.IO.Compression.ZipArchive]::new($taskStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($taskItem in $taskAllowed) {
    $taskPath = Join-Path $taskRoot $taskItem
    $taskFiles = if (Test-Path -LiteralPath $taskPath -PathType Container) { Get-ChildItem -LiteralPath $taskPath -File -Recurse -Force } else { Get-Item -LiteralPath $taskPath }
    foreach ($taskFile in $taskFiles) {
      $taskFullPath = [System.IO.Path]::GetFullPath($taskFile.FullName)
      if (-not $taskFullPath.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Source file outside workspace' }
      $taskRelative = $taskFullPath.Substring($taskRoot.Length + 1).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive, $taskFullPath, $taskRelative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  }
} finally { $taskArchive.Dispose(); $taskStream.Dispose() }
Get-Item -LiteralPath $taskOutput | Select-Object Name, Length
