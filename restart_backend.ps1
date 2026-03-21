$port = 8080
$tcpConnections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($tcpConnections) {
    $pids = $tcpConnections.OwningProcess | Select-Object -Unique
    foreach ($p in $pids) {
        Write-Host "Killing process ID $p listening on port $port..."
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Bắt đầu khởi động lại Spring Boot..."
.\mvnw spring-boot:run
