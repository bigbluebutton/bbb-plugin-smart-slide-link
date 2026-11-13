# Smart Slide Link Plugin – Automated Tests

Two suites:

| Suite | Tool | Where | Command |
|---|---|---|---|
| Unit | Vitest + React Testing Library | `tests/unit/` | `npm run test:unit` |
| End-to-end | Playwright, against a real BBB server | `tests/structural/`, `tests/behavioral/` | `npm test` |

The end-to-end infrastructure lives in `tests/core/` and follows
[bbb-plugin-pick-random-user](https://github.com/bigbluebutton/bbb-plugin-pick-random-user/tree/v0.1.x/tests).

---

## End-to-end tests

### How a test meeting is set up

Each suite creates a meeting with the `create` API, passing:

- `pluginManifests` pointing at the plugin's manifest, and
- the test presentation, `tests/fixtures/smart-slide-links.pdf`, uploaded in the create call's
  POST body (`<modules><module name="presentation">`), so it does not need to be hosted.

It then joins as a moderator — the presenter, the only role that sees the presentation
toolbar — and waits until the presentation finishes converting.

The presentation has three slides:

| Slide | Content |
|---|---|
| 1 | Two http(s) links and one `javascript:` link (must be ignored) |
| 2 | No links |
| 3 | The word "BBB" in the prose before the links marker |

To change the slides, edit `SLIDES` in `tests/fixtures/generate-presentation.mjs`, run
`node tests/fixtures/generate-presentation.mjs`, and update `SLIDES` in `tests/helpers.ts`.

### Scenarios

- **Structural** (`tests/structural/test.spec.ts`): one toolbar button per safe link, with
  the link's label; no button for the `javascript:` link.
- **Behavioral** (`tests/behavioral/test.spec.ts`): a click opens the url in a new tab with no
  `window.opener`; the buttons go away on a slide without links, change to the next slide's
  links, and come back when returning to the first slide.

### 1 – Install dependencies

```bash
npm install
npx playwright install --with-deps chromium
```

### 2 – Configure environment variables

```bash
cp .env.template .env
# edit .env and set BBB_URL and BBB_SECRET (bbb-conf --secret on the server)
```

| Variable | Required | Description |
|----------|----------|-------------|
| `BBB_URL` | **yes** | Full API URL, e.g. `https://bbb.example.com/bigbluebutton/` |
| `BBB_SECRET` | **yes** | Shared secret of the BBB server |
| `SMART_SLIDE_LINK_PLUGIN_URL` | no | Direct URL to `manifest.json`; defaults to `https://<server>/plugins/bbb-plugin-smart-slide-link/manifest.json` |
| `LOCAL_CONTAINER_NAME` | no | Docker container name for `npm run publish-plugin:dev` |
| `TIMEOUT_MULTIPLIER` | no | Multiply all timeouts (default 1 locally, 2 in CI) |
| `CI` | no | `"true"` enables CI reporter and single-worker mode |
| `TEST_MEETINGS` | no | `"isolated"` gives each test its own meeting (see below) |

When the manifest cannot be fetched, the tests are **skipped**, not failed.

### 3 – Build and deploy the plugin

```bash
npm run build-bundle
npm run publish-plugin:dev   # copies dist/ into $LOCAL_CONTAINER_NAME
```

`publish-plugin:dev` installs the bundle where the debian package does
(`/var/www/bigbluebutton-default/assets/plugins/bbb-plugin-smart-slide-link/`), which the
server serves at `/plugins/bbb-plugin-smart-slide-link/`. For any other server, deploy `dist/`
yourself and set `SMART_SLIDE_LINK_PLUGIN_URL`.

### 4 – Run

```bash
npm test                          # all suites, one shared meeting per suite
npm run test:isolated             # one meeting per test
npm test -- tests/structural      # one suite
npm test -- -g "new tab"          # one test by name
npx playwright show-report        # HTML report of the last run
```

| Mode | Meetings | When to use |
|------|----------|-------------|
| default (`npm test`) | one per suite | Normal development |
| isolated (`npm run test:isolated`) | one per test | Debugging state leaking between tests |

Reports, traces, screenshots and videos go to `playwright-report/` and `test-results/`.
