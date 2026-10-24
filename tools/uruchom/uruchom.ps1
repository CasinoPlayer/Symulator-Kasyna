# =====================================================================================================
# tools/uruchom/uruchom.ps1 — uruchomienie Cebulion Casino bez IntelliJ (wywołuje go Uruchom-projekt.bat).
#
#   1. szuka JDK 21+ (JAVA_HOME, java z PATH, typowe katalogi instalacji, JDK pobrane przez IntelliJ);
#      gdy go nie ma, proponuje instalację Eclipse Temurin 21 przez winget,
#   2. startuje aplikację przez Maven Wrapper (mvnw.cmd spring-boot:run): Maven i biblioteki pobierają się same,
#   3. czeka na http://localhost:8080, pokazuje konta zespołu z bazy i otwiera przeglądarkę.
#
# Konta zespołu dodaje sama aplikacja: profil dev tworzy tabele od nowa i przy każdym starcie wczytuje
# src/main/resources/data.sql. Zatrzymanie: Ctrl+C w oknie albo zamknięcie okna.
# Skrypt działa w Windows PowerShell 5.1 (wbudowany w Windows 10/11).
# =====================================================================================================
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root
$url = 'http://localhost:8080/'
# Ten sam adres co spring.datasource.url w application.properties (inaczej H2 odrzuci drugie połączenie).
$dbUrl = 'jdbc:h2:file:./data/wdtb;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE'

function Write-Step($text) { Write-Host "`n>> $text" -ForegroundColor Cyan }
function Write-Fail($text) { Write-Host "`n!! $text" -ForegroundColor Red }

# java -XshowSettings:properties wypisuje ustawienia na stderr; zbieramy je jako jeden tekst.
function Get-JavaProperties($javaExe) {
    $ErrorActionPreference = 'Continue'
    $lines = & $javaExe -XshowSettings:properties -version 2>&1 | ForEach-Object { "$_" }
    return ($lines -join "`n")
}

# Główna wersja JDK w katalogu (21, 25…) albo 0, gdy nie ma tam pełnego JDK (java.exe i javac.exe).
function Get-JdkMajor($javaHome) {
    if (-not $javaHome) { return 0 }
    $java = Join-Path $javaHome 'bin\java.exe'
    if (-not (Test-Path $java) -or -not (Test-Path (Join-Path $javaHome 'bin\javac.exe'))) { return 0 }
    if ((Get-JavaProperties $java) -match 'java\.specification\.version = (\d+)') { return [int]$Matches[1] }
    return 0
}

# JDK 21+; najpierw dokładnie 21 (wersja projektu), potem najnowsze. JAVA_HOME bywa ustawione na starszą
# Javę przez inne programy, dlatego nie ufamy mu ślepo.
function Find-Jdk {
    $homes = New-Object System.Collections.Generic.List[string]
    if ($env:JAVA_HOME) { $homes.Add($env:JAVA_HOME.Trim('"').TrimEnd('\')) }
    $onPath = Get-Command java.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($onPath -and ((Get-JavaProperties $onPath.Source) -match 'java\.home = (.+)')) { $homes.Add($Matches[1].Trim()) }
    $patterns = @(
        "$env:ProgramFiles\Java\*", "$env:ProgramFiles\Eclipse Adoptium\*", "$env:ProgramFiles\Microsoft\jdk-*",
        "$env:ProgramFiles\Zulu\*", "$env:ProgramFiles\Amazon Corretto\*", "$env:ProgramFiles\BellSoft\*",
        "$env:USERPROFILE\.jdks\*", "$env:LOCALAPPDATA\Programs\Eclipse Adoptium\*"
    )
    foreach ($pattern in $patterns) {
        Get-ChildItem -Path $pattern -Directory -ErrorAction SilentlyContinue | ForEach-Object { $homes.Add($_.FullName) }
    }
    $found = foreach ($candidate in ($homes | Select-Object -Unique)) {
        $major = Get-JdkMajor $candidate
        if ($major -ge 21) { [pscustomobject]@{ Home = $candidate; Major = $major } }
    }
    return $found | Sort-Object @{ Expression = { $_.Major -ne 21 } }, @{ Expression = 'Major'; Descending = $true } |
        Select-Object -First 1
}

function Get-StartPage {
    try { return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3).Content } catch { return $null }
}

# Konta zespołu prosto z bazy (H2 Shell łączy się z działającą aplikacją dzięki AUTO_SERVER=TRUE);
# gdyby się nie udało, lista z data.sql.
function Show-TeamAccounts($javaHome) {
    $h2 = Get-ChildItem (Join-Path $env:USERPROFILE '.m2\repository\com\h2database\h2') -Recurse -Filter 'h2-*.jar' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch 'sources|javadoc' } |
        Sort-Object { $v = $null; if ([version]::TryParse($_.Directory.Name, [ref]$v)) { $v } else { [version]'0.0' } } -Descending |
        Select-Object -First 1
    if ($h2) {
        $ErrorActionPreference = 'Continue'
        $out = & (Join-Path $javaHome 'bin\java.exe') -cp $h2.FullName org.h2.tools.Shell -url $dbUrl -user sa `
            -sql 'SELECT display_name, email, role FROM user_account ORDER BY id' 2>&1 | ForEach-Object { "$_" }
        if (($out -join "`n") -match '\(\d+ rows?,') {
            Write-Step 'Konta w bazie (tabela user_account, wczytane z data.sql):'
            $out | ForEach-Object { Write-Host "   $_" }
            return
        }
    }
    $sql = Get-Content (Join-Path $root 'src\main\resources\data.sql') -Raw -Encoding UTF8
    Write-Step 'Konta zespołu z data.sql (aplikacja wczytuje je przy każdym starcie):'
    [regex]::Matches($sql, "\('([^']+@[^']+)',\s*'([^']+)'") | ForEach-Object { Write-Host "   $($_.Groups[2].Value)  <$($_.Groups[1].Value)>" }
}

Write-Host '=== Cebulion Casino: uruchomienie projektu ===' -ForegroundColor Yellow

# --- port 8080: aplikacja może już działać (np. z IntelliJ) albo port zajmuje inny program
if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
    $page = Get-StartPage
    if ($page -and $page -match 'Cebulion') {
        Write-Step "Aplikacja już działa: $url (otwieram przeglądarkę)."
        Start-Process $url
        exit 0
    }
    $owner = Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object -First 1
    $process = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
    Write-Fail "Port 8080 zajmuje inny program: $($process.ProcessName) (PID $($owner.OwningProcess)). Zamknijcie go (np. poprzednie uruchomienie w IntelliJ: czerwony kwadrat) i uruchomcie ponownie."
    exit 1
}

# --- Java 21+
$jdk = Find-Jdk
if (-not $jdk) {
    Write-Fail 'Nie znaleziono Javy (JDK) w wersji 21 lub nowszej.'
    if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
        $answer = Read-Host 'Zainstalować teraz Eclipse Temurin JDK 21 przez winget? [T/N]'
        if ($answer -match '^[TtYy]') {
            winget install --id EclipseAdoptium.Temurin.21.JDK --exact
            $jdk = Find-Jdk
        }
    }
    if (-not $jdk) {
        Write-Host 'Zainstalujcie JDK 21 (https://adoptium.net/temurin/releases/?version=21 albo w IntelliJ:'
        Write-Host 'File > Project Structure > SDK > Download JDK) i uruchomcie Uruchom-projekt.bat ponownie.'
        exit 1
    }
}
$env:JAVA_HOME = $jdk.Home
$env:Path = (Join-Path $jdk.Home 'bin') + ';' + $env:Path
Write-Step "Java $($jdk.Major): $($jdk.Home)"

# --- start aplikacji w tym samym oknie (logi Springa widać poniżej)
Write-Step 'Start aplikacji (mvnw spring-boot:run). Za pierwszym razem Maven pobiera biblioteki (ok. 150 MB): kilka minut.'
$app = Start-Process -FilePath (Join-Path $root 'mvnw.cmd') -ArgumentList '--no-transfer-progress', 'spring-boot:run' `
    -WorkingDirectory $root -NoNewWindow -PassThru
$null = $app.Handle   # bez tego ExitCode procesu z Start-Process bywa pusty

$deadline = (Get-Date).AddMinutes(20)
while (-not (Get-StartPage)) {
    if ($app.HasExited) {
        Write-Fail "Aplikacja nie wystartowała (kod $($app.ExitCode)). Przewińcie okno w górę: pierwszy ERROR albo BUILD FAILURE mówi, co poprawić."
        exit 1
    }
    if ((Get-Date) -gt $deadline) {
        Write-Fail "Aplikacja nie odpowiada na $url po 20 minutach. Sprawdźcie logi powyżej."
        exit 1
    }
    Start-Sleep -Seconds 2
}

Show-TeamAccounts $jdk.Home
Start-Process $url
Write-Host "`nGOTOWE: $url   (konsola bazy: ${url}h2-console, JDBC URL: $dbUrl, użytkownik sa, hasło puste)" -ForegroundColor Green
Write-Host 'Zatrzymanie aplikacji: Ctrl+C w tym oknie albo zamknięcie okna.' -ForegroundColor Green
$app.WaitForExit()
