# Check SSL Certificate for www.amerilendloan.com

$url = "https://www.amerilendloan.com"
$uri = [System.Uri]$url

try {
    # Connect to the server
    $tcpClient = [System.Net.Sockets.TcpClient]::new()
    $tcpClient.Connect($uri.Host, 443)
    
    # Create SSL stream
    $sslStream = [System.Net.Security.SslStream]::new($tcpClient.GetStream())
    
    # Authenticate
    $sslStream.AuthenticateAsClient($uri.Host)
    
    # Get certificate
    $cert = $sslStream.RemoteCertificate
    $x509 = [System.Security.Cryptography.X509Certificates.X509Certificate2]$cert
    
    Write-Host "============================================================"
    Write-Host "SSL Certificate Information for: $($uri.Host)" -ForegroundColor Cyan
    Write-Host "============================================================"
    
    Write-Host "Subject: $($x509.Subject)"
    Write-Host "Issuer: $($x509.Issuer)"
    Write-Host "Thumbprint: $($x509.Thumbprint)"
    
    Write-Host "`nValidity Period:"
    Write-Host "  Valid From: $($x509.NotBefore)"
    Write-Host "  Valid Until: $($x509.NotAfter)"
    
    $now = [DateTime]::Now
    $isValid = ($now -ge $x509.NotBefore) -and ($now -le $x509.NotAfter)
    
    Write-Host "`nCurrent Status:"
    if ($isValid) {
        Write-Host "  Certificate Status: VALID [OK]" -ForegroundColor Green
    } else {
        Write-Host "  Certificate Status: INVALID [EXPIRED]" -ForegroundColor Red
    }
    
    $daysUntilExpiry = ($x509.NotAfter - $now).Days
    Write-Host "  Days Until Expiration: $daysUntilExpiry days"
    
    if ($daysUntilExpiry -le 30) {
        Write-Host "  WARNING: Certificate expires soon!" -ForegroundColor Yellow
    }
    
    $sslStream.Close()
    $tcpClient.Close()
    
} catch {
    Write-Host "Error checking SSL certificate: $($_.Exception.Message)" -ForegroundColor Red
}
