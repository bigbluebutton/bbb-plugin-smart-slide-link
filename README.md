# Smart Slide Link — a BigBlueButton plugin

## Description

Turns links written on a presentation slide into buttons on the presentation toolbar. When
the presenter shows a slide whose text contains the `BBB` marker followed by a links JSON,
the plugin adds one toolbar button per link; clicking it opens the link in a new tab. The
buttons change with the slide and disappear on slides without links.

Write the links anywhere on the slide (the JSON may wrap over several lines):

```
BBB{"links": [
  {"url": "https://example.com/docs", "label": "Open docs"},
  {"url": "https://example.org", "label": "Visit site"}
]}
```

- Only `http:` and `https:` urls become buttons; anything else (`javascript:`, `data:`,
  relative paths…) is ignored.
- Links open with `noopener,noreferrer`, so the opened page has no access to the meeting.
- The presentation toolbar is shown to the presenter only, so only the presenter sees the
  buttons.
- Slide text is read the way BigBlueButton extracts it (pdftotext), so the JSON must use
  plain straight quotes (`"`). Office apps that auto-replace them with typographic quotes
  (`“ ”`) produce text the plugin cannot parse.

## Compatibility

This branch (`v0.1.x`) targets **BigBlueButton 4.0** (tested against 4.0.2, which bundles
`bigbluebutton-html-plugin-sdk@1.0.0-beta.3`). For BigBlueButton 3.x use the `v0.0.x` branch.

Building requires Node.js >= 24.15 (see `.nvmrc`) and npm >= 11.

## Building the Plugin

To build the plugin for production use, follow these steps:

```bash
cd $HOME/src/bbb-plugin-smart-slide-link
npm ci
npm run build-bundle
```

The above command will generate the `dist` folder, containing the bundled JavaScript file
named `BbbPluginSmartSlideLink.js`, the `manifest.json` and the `locales/` folder. Host them
together on any HTTPS server.

If you install the Plugin separated to the manifest, remember to change the
`javascriptEntrypointUrl` in the `manifest.json` to the correct endpoint.

To use the plugin in BigBlueButton, send this parameter along in create call:

```
pluginManifests=[{"url":"<your-domain>/path/to/manifest.json"}]
```

Or additionally, you can add this same configuration in the `.properties` file from `bbb-web`
in `/usr/share/bbb-web/WEB-INF/classes/bigbluebutton.properties`

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `debug` | boolean | `false` | Lowers the plugin's log level to `debug` (logs how many links each slide has and the url of each opened link). |

```yaml
# /etc/bigbluebutton/bbb-html5.yml
public:
  plugins:
    - name: BbbPluginSmartSlideLink
      settings:
        debug: false
```

## Translations

User-facing text lives in `public/locales/` (`en.json`, `pt-BR.json`); `index.json` lists the
shipped files so regional locales fall back to their language.

## Development mode

As for development mode (running this plugin from source), please, refer back to
https://github.com/bigbluebutton/bigbluebutton-html-plugin-sdk section `Running the Plugin from Source`

## Running the tests

Unit tests use [Vitest](https://vitest.dev/) and React Testing Library and live in
`tests/unit/`:

```bash
npm run test:unit            # run once
npm run test:unit:watch      # watch mode
npm run test:unit:coverage   # with coverage report in coverage/
```

End-to-end tests use [Playwright](https://playwright.dev/) against a real BigBlueButton
server (`npm test`). See [tests/README.md](tests/README.md) for setup.
