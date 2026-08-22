#!/usr/bin/env python3
"""A small App Store Connect client for the release workflows.

Two jobs use it:

  beta-add   after every TestFlight upload, hand the new build to the public
             beta group so external testers get it without a manual click
  promote    on an `ios-v*` tag, put the newest build of that train in front of
             App Review

Only the calls those two need are implemented. Everything else about the store
listing — description, keywords, screenshots — is edited in App Store Connect
and stays there; it changes on its own schedule, not on every commit.

Auth: an App Store Connect API key with the **App Manager** role or higher.
Set ASC_KEY_ID and ASC_ISSUER_ID, and provide the .p8 either as ASC_KEY_CONTENT
(base64) or at ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8.

The token is minted here rather than through `xcrun altool --generate-jwt` so
the script also runs on a Linux runner.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.appstoreconnect.apple.com"

# States in which a version record still accepts edits. Anything else means the
# version is with Apple or already sold, and a new one has to be created.
EDITABLE = {
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
}


class AscError(RuntimeError):
    pass


def _private_key() -> bytes:
    content = os.environ.get("ASC_KEY_CONTENT")
    if content:
        return base64.b64decode(content)
    key_id = os.environ["ASC_KEY_ID"]
    path = pathlib.Path.home() / ".appstoreconnect/private_keys" / f"AuthKey_{key_id}.p8"
    if not path.exists():
        raise AscError(f"no private key: set ASC_KEY_CONTENT or place it at {path}")
    return path.read_bytes()


def _token() -> str:
    """Mint an ES256 JWT the way App Store Connect wants it."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec, utils

    key = serialization.load_pem_private_key(_private_key(), password=None)
    header = {"alg": "ES256", "kid": os.environ["ASC_KEY_ID"], "typ": "JWT"}
    now = int(time.time())
    payload = {
        "iss": os.environ["ASC_ISSUER_ID"],
        "iat": now,
        # Apple rejects anything longer than 20 minutes.
        "exp": now + 15 * 60,
        "aud": "appstoreconnect-v1",
    }

    def seg(obj: dict) -> bytes:
        raw = json.dumps(obj, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=")

    signing_input = seg(header) + b"." + seg(payload)
    der = key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    # JWS wants the raw r‖s pair, not the DER structure OpenSSL hands back.
    r, s = utils.decode_dss_signature(der)
    raw = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return (signing_input + b"." + base64.urlsafe_b64encode(raw).rstrip(b"=")).decode()


class Asc:
    def __init__(self, app_id: str):
        self.app_id = app_id
        self.token = _token()

    def call(self, method: str, path: str, body: dict | None = None) -> dict:
        req = urllib.request.Request(
            BASE + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
        )
        req.add_header("Authorization", "Bearer " + self.token)
        if body is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as res:
                raw = res.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as err:
            detail = err.read().decode()
            try:
                errors = json.loads(detail)["errors"]
                detail = "\n".join(f"  {e['code']}: {e['detail']}" for e in errors)
            except Exception:
                pass
            raise AscError(f"{method} {path} → {err.code}\n{detail}") from None

    def get(self, path: str, **params) -> list[dict]:
        query = urllib.parse.urlencode(params)
        return self.call("GET", f"{path}?{query}" if query else path).get("data", [])

    # ── builds ────────────────────────────────────────────────────────────
    def build(self, train: str, number: str | None) -> dict:
        """The build numbered `number` in version train `train`, or the newest."""
        params = {
            "filter[app]": self.app_id,
            "filter[preReleaseVersion.version]": train,
            "limit": 200,
        }
        if number:
            params["filter[version]"] = number
        builds = self.get("/v1/builds", **params)
        if not builds:
            raise AscError(f"no build {number or '(any)'} in train {train}")
        # "10" beats "9": compare numerically where we can, fall back to upload date.
        def key(b: dict):
            v = b["attributes"].get("version", "")
            return (int(v) if v.isdigit() else -1, b["attributes"].get("uploadedDate", ""))
        newest = max(builds, key=key)
        state = newest["attributes"]["processingState"]
        if state != "VALID":
            raise AscError(f"build {newest['attributes']['version']} is {state}, not VALID")
        return newest

    # ── TestFlight ────────────────────────────────────────────────────────
    def beta_group(self, name: str) -> dict:
        for group in self.get(f"/v1/apps/{self.app_id}/betaGroups", limit=200):
            if group["attributes"]["name"] == name:
                return group
        raise AscError(f"no beta group named {name!r}")

    # ── App Store version ─────────────────────────────────────────────────
    def editable_version(self, train: str) -> dict:
        """Reuse the open version record if there is one, else create it.

        There can only ever be one version in flight, so a second `ios-v*` tag
        before the first is approved updates the existing record instead of
        failing.
        """
        versions = self.get(
            f"/v1/apps/{self.app_id}/appStoreVersions",
            **{"filter[platform]": "IOS", "limit": 50},
        )
        for version in versions:
            if version["attributes"]["appStoreState"] not in EDITABLE:
                continue
            if version["attributes"]["versionString"] != train:
                version = self.call("PATCH", f"/v1/appStoreVersions/{version['id']}", {
                    "data": {"type": "appStoreVersions", "id": version["id"],
                             "attributes": {"versionString": train}}})["data"]
            return version
        return self.call("POST", "/v1/appStoreVersions", {
            "data": {"type": "appStoreVersions",
                     "attributes": {"platform": "IOS", "versionString": train},
                     "relationships": {"app": {"data": {"type": "apps", "id": self.app_id}}}}})["data"]

    def has_released_version(self) -> bool:
        return any(
            v["attributes"]["appStoreState"] == "READY_FOR_SALE"
            for v in self.get(f"/v1/apps/{self.app_id}/appStoreVersions",
                              **{"filter[platform]": "IOS", "limit": 50})
        )


def cmd_beta_add(args: argparse.Namespace) -> None:
    asc = Asc(args.app)
    build = asc.build(args.train, args.build)
    number = build["attributes"]["version"]
    group = asc.beta_group(args.group)
    asc.call("POST", f"/v1/betaGroups/{group['id']}/relationships/builds",
             {"data": [{"type": "builds", "id": build["id"]}]})
    print(f"build {args.train} ({number}) → {args.group}")

    # Adding the build to an external group is not the same as submitting it.
    # Without this second call the build sits in the group at
    # READY_FOR_BETA_SUBMISSION forever and no external tester ever sees it.
    state = asc.call("GET", f"/v1/builds/{build['id']}/buildBetaDetail")
    state = state["data"]["attributes"]["externalBuildState"]
    if state == "READY_FOR_BETA_SUBMISSION":
        asc.call("POST", "/v1/betaAppReviewSubmissions", {
            "data": {"type": "betaAppReviewSubmissions",
                     "relationships": {"build": {"data": {"type": "builds", "id": build["id"]}}}}})
        state = asc.call("GET", f"/v1/builds/{build['id']}/buildBetaDetail")
        state = state["data"]["attributes"]["externalBuildState"]

    # The first build of a version train is looked at by a human; the ones after
    # it are normally waved through within the hour.
    print("external state:", state)


def cmd_promote(args: argparse.Namespace) -> None:
    asc = Asc(args.app)
    build = asc.build(args.train, args.build)
    number = build["attributes"]["version"]
    version = asc.editable_version(args.train)
    print(f"version {args.train} ({version['attributes']['appStoreState']}), build {number}")

    asc.call("PATCH", f"/v1/appStoreVersions/{version['id']}/relationships/build",
             {"data": {"type": "builds", "id": build["id"]}})

    # "What's New" is rejected on a first release — there is nothing new yet.
    notes_dir = pathlib.Path(args.notes) if args.notes else None
    if notes_dir and asc.has_released_version():
        for loc in asc.get(f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations"):
            path = notes_dir / f"{loc['attributes']['locale']}.txt"
            if not path.exists():
                print(f"::warning::no release notes for {loc['attributes']['locale']} at {path}")
                continue
            asc.call("PATCH", f"/v1/appStoreVersionLocalizations/{loc['id']}", {
                "data": {"type": "appStoreVersionLocalizations", "id": loc["id"],
                         "attributes": {"whatsNew": path.read_text().strip()}}})
            print(f"release notes: {loc['attributes']['locale']}")

    if args.dry_run:
        print("dry run — not submitting")
        return

    # Reuse a submission that was created but never sent; Apple allows only one.
    open_subs = [s for s in asc.get("/v1/reviewSubmissions",
                                    **{"filter[app]": args.app, "filter[platform]": "IOS"})
                 if s["attributes"]["state"] == "READY_FOR_REVIEW"]
    submission = open_subs[0] if open_subs else asc.call("POST", "/v1/reviewSubmissions", {
        "data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"},
                 "relationships": {"app": {"data": {"type": "apps", "id": args.app}}}}})["data"]

    items = asc.get(f"/v1/reviewSubmissions/{submission['id']}/items")
    if not items:
        asc.call("POST", "/v1/reviewSubmissionItems", {
            "data": {"type": "reviewSubmissionItems", "relationships": {
                "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": submission["id"]}},
                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version["id"]}}}}})

    asc.call("PATCH", f"/v1/reviewSubmissions/{submission['id']}", {
        "data": {"type": "reviewSubmissions", "id": submission["id"],
                 "attributes": {"submitted": True}}})
    print(f"submitted {args.train} ({number}) for review")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--app", default=os.environ.get("ASC_APP_ID"),
                        help="App Store Connect app id (or ASC_APP_ID)")
    sub = parser.add_subparsers(dest="command", required=True)

    beta = sub.add_parser("beta-add", help="add a build to a TestFlight group")
    beta.add_argument("--train", required=True, help="marketing version, e.g. 0.2")
    beta.add_argument("--build", help="build number; default is the newest in the train")
    beta.add_argument("--group", default="Public Beta")
    beta.set_defaults(func=cmd_beta_add)

    promote = sub.add_parser("promote", help="submit a build to App Review")
    promote.add_argument("--train", required=True)
    promote.add_argument("--build")
    promote.add_argument("--notes", help="directory of <locale>.txt release notes")
    promote.add_argument("--dry-run", action="store_true")
    promote.set_defaults(func=cmd_promote)

    args = parser.parse_args()
    if not args.app:
        parser.error("--app or ASC_APP_ID is required")
    try:
        args.func(args)
    except AscError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
