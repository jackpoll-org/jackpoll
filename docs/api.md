# Jackpoll API

Scripts and AI agents (Claude Code, Codex, Cursor, …) can create and edit surveys through the same REST API the Jackpoll app uses.

## 1. Create an API key

Open **Settings → API keys**, give the key a name, choose when it expires (7, 30, 90 or 365 days, or never) and create it. Copy the key (`jp_…`) right away; it is shown only once. An expired key stops working immediately and is deleted automatically.

Every key can **manage surveys**: create, edit, publish and delete them, organize folders and manage share links. Turn on **"Also allow reading responses"** only if the agent needs response data, since responses contain personal data. Response access is read-only.

Without response access, a key can't touch your collected data indirectly either: it can't turn on public live results or student result pages, change data retention, or delete a survey that already has responses.

A key acts as you: it sees exactly the surveys you own or collaborate on. It can't manage API keys, your account, collaborators or webhooks. Keys keep working until they expire or you revoke them, also after a password change or "sign out everywhere", so revoke a key under **Settings → API keys** whenever you no longer need it. Each key is limited to 300 requests per minute.

## 2. Call the API

Base URL: `https://app.jackpoll.org/api` (self-hosted: `https://<your-host>/api`).
Send the key as a bearer token:

```bash
export JACKPOLL_KEY=jp_your_key

# Create a survey
curl -s https://app.jackpoll.org/api/surveys \
  -H "Authorization: Bearer $JACKPOLL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Team feedback"}'

# Replace its content (title, settings, questions) in one call
curl -s -X PUT https://app.jackpoll.org/api/surveys/<survey-id> \
  -H "Authorization: Bearer $JACKPOLL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team feedback",
    "status": "draft",
    "settings": {"allowMultipleResponses": false},
    "questions": [
      {"id": "q1", "type": "rating", "title": "How was this sprint?", "required": true, "order": 0},
      {"id": "q2", "type": "multiple-choice", "title": "Best day?", "required": false, "order": 1,
       "options": [{"id": "mon", "label": "Monday"}, {"id": "fri", "label": "Friday"}]},
      {"id": "q3", "type": "long-answer", "title": "Anything else?", "required": false, "order": 2}
    ]
  }'
```

`PUT /surveys/{id}` replaces the whole survey, so send every question you want to keep. Leave out `settings` or `sections` to keep the stored ones; each question's `sectionId` puts it on that page. Set `"status": "published"` to open it for responses. Close the survey in the Jackpoll editor while an agent changes it; otherwise the editor's autosave can overwrite the agent's changes.

In a quiz, a question's `points` and `correctAnswers` score it. For finer scoring, set in the question's `settings`: `optionPoints` (option id → points, also negative; single choice gives the chosen option's points, multiple choice adds them up, never below 0), `answerPoints` (accepted short answer → points) or `scoreOrder: true` on a `ranking` question (the option order is the correct order; respondents see it shuffled). These values are never sent to respondents.

Question types: `short-answer`, `long-answer`, `multiple-choice`, `checkboxes`, `dropdown`, `multiple-choice-grid`, `checkbox-grid`, `rating-grid`, `file-upload`, `slider`, `rating`, `date`, `ranking`, `signature`, `wordcloud`, `content` (text/image block without an answer).

## 3. Let your agent read the API description

The full OpenAPI description is at `https://app.jackpoll.org/api/openapi` (YAML, or JSON with `?format=json`). Point your agent at it, for example:

> Use the Jackpoll API described at https://app.jackpoll.org/api/openapi. My API key is in the JACKPOLL_KEY environment variable. Create a quiz with ten questions about …

Never paste the key into a shared prompt or commit it to a repository; keep it in an environment variable or your agent's secret store.

## 4. Read a published survey without a key

Published surveys can be read without an API key, for previews, archiving and clients that don't run JavaScript:

```bash
# By share-link slug (the part after /s/)
curl -s https://app.jackpoll.org/api/public/links/<slug>

# By survey id (the embed URL /embed/<id>)
curl -s https://app.jackpoll.org/api/public/surveys/<survey-id>
```

Both return the survey's title, description, sections and questions as JSON. Unpublished surveys return `404`. Surveys that are closed, not open yet, or behind an access code return `403`. Quiz answers are never included. Each public survey page links to its JSON with `<link rel="alternate" type="application/json">` and also carries the questions as plain HTML for clients without JavaScript.
