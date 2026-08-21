#!/usr/bin/env python3
"""Print `code=<n>` — the next usable Play version code for an app.

Google Play rejects an upload whose version code is not strictly higher than
every code it has ever seen for the package, including ones that only exist as
a draft or in a closed track. Counting CI runs therefore breaks as soon as a
build is uploaded from anywhere else, so the store itself is the source of
truth.

Usage (from the Mobile release workflow):
    next-play-version-code.py <service-account.json> <package-name>

Output goes to stdout in $GITHUB_OUTPUT format.
"""

import sys

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
TIMEOUT = 30


def main(service_account_file: str, package: str) -> int:
    credentials = service_account.Credentials.from_service_account_file(
        service_account_file, scopes=[SCOPE]
    )
    credentials.refresh(Request())
    headers = {"Authorization": f"Bearer {credentials.token}"}

    # Listing artifacts requires an open edit; it is discarded again below so
    # this never leaves a half-finished release lying around in the console.
    edit = requests.post(f"{API}/{package}/edits", headers=headers, timeout=TIMEOUT)
    edit.raise_for_status()
    edit_id = edit.json()["id"]

    try:
        codes = []
        for kind in ("bundles", "apks"):
            response = requests.get(
                f"{API}/{package}/edits/{edit_id}/{kind}", headers=headers, timeout=TIMEOUT
            )
            if response.ok:
                codes += [item["versionCode"] for item in response.json().get(kind, [])]
        print(f"code={max(codes) + 1 if codes else 1}")
    finally:
        requests.delete(
            f"{API}/{package}/edits/{edit_id}", headers=headers, timeout=TIMEOUT
        )
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1], sys.argv[2]))
