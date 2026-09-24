#!/bin/bash
# Build the app exactly like fdroiddata's "fdroid build" CI job does, inside
# registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie. Used by
# fdroid-release.yml to produce the APK we sign and publish for F-Droid's
# reproducible-build check (their build must match this one byte for byte).
#
# Expects /builds/fdroiddata/metadata/<appid>.yml and APPID / VERCODE env.
set -euo pipefail
CI_PROJECT_DIR=/builds/fdroiddata
cd "$CI_PROJECT_DIR"
source /etc/profile.d/bsenv.sh
apt-get update -qq >/dev/null
rm -rf "$fdroidserver" && mkdir "$fdroidserver"
curl -fsS https://gitlab.com/fdroid/fdroidserver/-/archive/master/fdroidserver-master.tar.gz \
  | tar -xz --directory="$fdroidserver" --strip-components=1
export PATH="$fdroidserver:$PATH" PYTHONPATH="$fdroidserver:$fdroidserver/examples"
export PYTHONUNBUFFERED=true serverwebroot=/tmp
git -C "$home_vagrant/gradlew-fdroid" pull -q || true
for d in logs tmp unsigned "$home_vagrant/.android" "$home_vagrant/.gradle" "$home_vagrant/metadata"; do
  mkdir -p "$d"; chown -R vagrant "$d"
done
ln -sfn "$CI_PROJECT_DIR/tmp" "$home_vagrant/tmp"
export GRADLE_USER_HOME="$home_vagrant/.gradle"
apt-get install -y -qq sudo openjdk-21-jdk-headless >/dev/null
update-alternatives --set java /usr/lib/jvm/java-21-openjdk-amd64/bin/java
mkdir -p "$CI_PROJECT_DIR/build" && cp -R "$CI_PROJECT_DIR/build" "$home_vagrant/build"
cp "metadata/$APPID.yml" "$home_vagrant/metadata/"
chown -R vagrant "$home_vagrant" "$CI_PROJECT_DIR"
cd "$home_vagrant"
# Clones the app source into build/<appid> (as in fdroiddata CI).
ln -sfn "$CI_PROJECT_DIR" "$home_vagrant/fdroiddata"
sudo --preserve-env --user vagrant \
  env PATH="$fdroidserver:$PATH" PYTHONPATH="$fdroidserver:$fdroidserver/examples" \
      PYTHONUNBUFFERED=true HOME="$home_vagrant" \
  fdroid fetchsrclibs "$APPID:$VERCODE" --verbose
rm "$home_vagrant/fdroiddata"
(unset CI; sudo --preserve-env --user vagrant \
  env PATH="$fdroidserver:$PATH" PYTHONPATH="$fdroidserver:$fdroidserver/examples" \
      PYTHONUNBUFFERED=true HOME="$home_vagrant" \
  fdroid build --verbose --test --refresh-scanner --on-server --no-tarball "$APPID:$VERCODE")
ls -la "$CI_PROJECT_DIR/tmp"
