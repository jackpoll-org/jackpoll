# syntax=docker/dockerfile:1

# ── Build (Maven, JDK 21) ───────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# Prime the dependency cache first for faster rebuilds.
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp dependency:go-offline
COPY src ./src
# Tests need Dev Services (Docker) and run in CI separately, so skip here.
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp clean package -DskipTests

# ── Runtime (JRE only, Quarkus fast-jar) ────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
ENV LANG=C.UTF-8
RUN addgroup -S quarkus && adduser -S quarkus -G quarkus

# Quarkus fast-jar layout: lib/ is largest & most cache-friendly, so copy it
# first; quarkus-run.jar last.
COPY --from=build /app/target/quarkus-app/lib/ ./lib/
COPY --from=build /app/target/quarkus-app/*.jar ./
COPY --from=build /app/target/quarkus-app/app/ ./app/
COPY --from=build /app/target/quarkus-app/quarkus/ ./quarkus/

# Secret-file loader (#49): exports any FOO_FILE → FOO before starting.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod 755 /app/docker-entrypoint.sh

USER quarkus
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
