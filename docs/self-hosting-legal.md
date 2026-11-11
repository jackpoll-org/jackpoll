# Legal notice and privacy policy on a self-hosted instance

If you run Jackpoll for the public, you usually have to publish who runs it (an Impressum in Germany) and how you process personal data. Jackpoll serves these pages for you; you only provide the text. Nothing is shown until you configure it.

## Configure the pages

Set these environment variables on the **frontend** container. They are read at runtime, so the published image works without a rebuild.

| Page | Route | Your own page elsewhere | Markdown file served by Jackpoll |
|---|---|---|---|
| Legal notice / Impressum | `/impressum` | `LEGAL_IMPRINT_URL` | `LEGAL_IMPRINT_FILE` |
| Privacy policy | `/privacy` | `LEGAL_PRIVACY_URL` | `LEGAL_PRIVACY_FILE` |
| Terms of use (optional) | `/terms` | `LEGAL_TERMS_URL` | `LEGAL_TERMS_FILE` |

- A `…_URL` must be an absolute `https://` (or `http://`) address. The links point there, and the Jackpoll route redirects to it.
- A `…_FILE` is the path of a Markdown file inside the container. Jackpoll renders it at the route. Raw HTML in the file is not rendered.
- If both are set, the URL wins. A page with neither returns `404` and its links are hidden.
- If the file can't be read (wrong path, missing volume), the page returns `404` and the frontend logs the path and the error.
- `LEGAL_ENTITY` sets the operator name shown in the footer (`© <year> <name>`). The backend reads the same variable for the legal line in its emails, so one value covers both.

Example with Docker Compose:

```yaml
services:
  frontend:
    environment:
      LEGAL_IMPRINT_FILE: /legal/imprint.md
      LEGAL_PRIVACY_FILE: /legal/privacy.md
      LEGAL_ENTITY: "Sportverein Musterstadt e.V."
    volumes:
      - ./legal:/legal:ro
```

Edits to the Markdown files show up on the next page load. Changing an environment variable needs a container restart.

## Where the links appear

Once configured, the links appear on these pages, also for visitors without JavaScript. Links to an external URL open in a new tab.

- login and registration pages
- the dashboard sidebar
- shared surveys (`/s/…`), embedded surveys (`/embed/…`) and the response, edit-link, results and collaboration pages
- the survey's own privacy notice or consent box above the submit button, when the survey has one

## Instance privacy vs. survey consent

The privacy policy configured here describes **your instance**: accounts, hosting, logs and the data Jackpoll stores. What a single survey asks for and why is up to its creator. They write it in the survey's own privacy notice and consent checkbox (survey settings), which is shown next to your instance privacy link, not instead of it.
