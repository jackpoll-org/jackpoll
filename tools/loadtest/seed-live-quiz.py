#!/usr/bin/env python3
"""Create a published live-quiz survey for the k6 load test and print its id.

Usage: API=http://localhost:8090 KC=http://localhost:8180 python3 seed-live-quiz.py
"""

import json
import os
import uuid
import urllib.parse
import urllib.request

API = os.environ.get("API", "http://localhost:8090") + "/api/v1"
KC = os.environ.get("KC", "http://localhost:8180")
QUESTIONS = int(os.environ.get("QUESTIONS", "10"))


def token() -> str:
    body = urllib.parse.urlencode({
        "grant_type": "password",
        "client_id": "survey-backend",
        "client_secret": os.environ.get("KC_SECRET", "secret"),
        "username": os.environ.get("KC_USER", "testuser@survey.local"),
        "password": os.environ.get("KC_PASS", "Test1234"),
    }).encode()
    url = f"{KC}/realms/survey-school/protocol/openid-connect/token"
    with urllib.request.urlopen(url, body) as res:
        return json.load(res)["access_token"]


def call(method: str, path: str, tok: str, payload: dict) -> dict:
    req = urllib.request.Request(
        API + path,
        data=json.dumps(payload).encode(),
        method=method,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        return json.load(res)


def question(i: int, prefix: str) -> dict:
    options = [{"id": f"{prefix}q{i}o{j}", "label": f"Option {j + 1}"} for j in range(4)]
    return {
        "id": f"{prefix}q{i}",
        "type": "multiple-choice",
        "title": f"Load test question {i + 1}",
        "required": False,
        "order": i,
        "options": options,
        "points": 1000,
        "correctAnswers": [options[0]["id"]],
    }


def main() -> None:
    tok = token()
    created = call("POST", "/surveys", tok, {"title": "k6 live quiz load test"})
    survey_id = created["data"]["id"]
    call("PUT", f"/surveys/{survey_id}", tok, {
        "title": "k6 live quiz load test",
        "status": "published",
        "settings": {
            "isQuiz": True,
            "liveMode": True,
            "liveQuestionSeconds": 20,
            "allowMultipleResponses": True,
        },
        # Question/option ids are global primary keys, so prefix them per survey.
        "questions": [question(i, uuid.uuid4().hex[:8] + "-") for i in range(QUESTIONS)],
    })
    print(survey_id)


if __name__ == "__main__":
    main()
