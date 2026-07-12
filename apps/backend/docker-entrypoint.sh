#!/bin/sh
# Load Docker/Portainer secrets (#49): for any FOO_FILE env that points at a
# readable file, export FOO with the file's contents. Lets secrets be mounted
# at /run/secrets/* instead of passed as plaintext environment variables.
set -e

for var in $(env | grep '_FILE=' | cut -d '=' -f 1); do
  base="${var%_FILE}"
  file="$(printenv "$var")"
  if [ -f "$file" ]; then
    export "$base"="$(cat "$file")"
  fi
done

exec java $JAVA_OPTS -jar /app/quarkus-run.jar
