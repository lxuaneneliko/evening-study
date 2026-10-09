param([Parameter(Mandatory = $true)][string]$FilePath)
$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $FilePath
[pscustomobject]@{
    Path = (Get-Item -LiteralPath $FilePath).FullName
    Status = $signature.Status.ToString()
    SignerThumbprint = $signature.SignerCertificate.Thumbprint
    Timestamped = [bool]$signature.TimeStamperCertificate
} | ConvertTo-Json -Compress
