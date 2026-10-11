# syntax=docker/dockerfile:1
# =====================================================================================================
# Cebulion Casino: obraz Dockera do uruchomienia na serwerze (Render.com, Fly.io, Koyeb albo lokalnie).
#
#   docker build -t cebulion-casino .
#   docker run --rm -p 8080:8080 -v kasyno-dane:/app/data cebulion-casino
#   → http://localhost:8080   (profil prod: baza H2 w /app/data, przetrwa restart dzięki wolumenowi)
#
# Budowanie wieloetapowe (multi-stage): etap "build" ma pełnego Mavena i JDK (ok. 800 MB), ale do obrazu
# końcowego trafia tylko gotowy plik .jar i samo środowisko uruchomieniowe Javy (JRE). Obraz jest mniejszy,
# szybciej się wdraża i nie zawiera narzędzi, których aplikacja nie potrzebuje do działania.
# =====================================================================================================

# ---------- etap 1: kompilacja i spakowanie aplikacji ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Najpierw sam pom.xml i pobranie zależności: ta warstwa trafia do pamięci podręcznej Dockera i przy zmianie
# samego kodu (bez zmiany pom.xml) zależności nie są pobierane od nowa.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Testy uruchamia GitHub Actions i `mvn verify` lokalnie; tu tylko budujemy plik .jar
RUN mvn -B -q -DskipTests package && cp target/wdtb-2026-backend-kasyno-*.jar /build/app.jar

# ---------- etap 2: obraz uruchomieniowy ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

# curl do sprawdzania stanu (HEALTHCHECK); instalujemy tylko, gdy obraz bazowy go nie ma
RUN command -v curl >/dev/null 2>&1 \
    || (apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*)

# Użytkownik bez uprawnień administratora: gdyby ktoś przejął aplikację, nie dostaje roota w kontenerze
RUN groupadd --system kasyno \
    && useradd --system --gid kasyno --home-dir /app --shell /usr/sbin/nologin kasyno \
    && mkdir -p /app/data \
    && chown -R kasyno:kasyno /app

COPY --from=build --chown=kasyno:kasyno /build/app.jar /app/app.jar

USER kasyno

# Profil prod: trwała baza (ddl-auto=update), data.sql tylko przy pierwszym starcie, bez konsoli H2.
# KASYNO_DATA_DIR: katalog pliku bazy H2 (podłączcie tu wolumen, żeby dane przetrwały usunięcie kontenera).
# JAVA_TOOL_OPTIONS: Java bierze najwyżej 75% pamięci kontenera (darmowe plany mają ok. 512 MB).
ENV SPRING_PROFILES_ACTIVE=prod \
    KASYNO_DATA_DIR=/app/data \
    PORT=8080 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

VOLUME /app/data
EXPOSE 8080

# Stan aplikacji: katalog gier odpowiada 200 dopiero, gdy działa serwer WWW i baza (z danymi automatów).
# start-period: pierwszy start (tworzenie tabel, data.sql) może potrwać kilkadziesiąt sekund na słabym planie.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8080}/api/slots" > /dev/null || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
