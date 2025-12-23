# Symbiotic Security Documentation

This repository contains the source for the Symbiotic Security public documentation site, built with Mintlify.

- Live site: docs.symbioticsec.ai

## Prerequisites

- Node.js (LTS recommended)
- npm or yarn

You can preview the docs locally using the Mintlify CLI. No local build step is required beyond running the dev server.

## Quick start (local)

1. Install the Mintlify CLI (one-time):
   - npm: `npm i -g mintlify`
   - or use npx without global install: `npx mintlify@latest dev`
2. From the project root, start the dev server:
   - `mintlify dev`
   - or `npx mintlify@latest dev`
3. Open the printed local URL to preview the docs with hot reload.

The dev server reads `docs.json` for site configuration and the MDX content under `content/` and the root MDX files.

## Project structure

- `docs.json` — Mintlify site configuration (theme, navigation, navbar/footer, etc.)
- `index.mdx` — Landing page
- `changelog.mdx` — Changelog page
- `content/` — Sectioned documentation content written in MDX
  - `content/devs/` — Developer-focused guides and references
  - `content/admins/` — Admin features and integrations
  - Other topical pages as needed
- `images/` — Static assets referenced by pages

Navigation is primarily configured in `docs.json` (see `navigation.dropdowns`). Each page entry typically references a path without the `.mdx` extension, e.g. `content/devs/intro/quickstart` resolves to `content/devs/intro/quickstart.mdx`.

## Authoring guidelines

- Write pages in MDX (`.mdx`). Standard Markdown is supported, plus JSX-style components that Mintlify provides.
- Keep file and directory names lowercase with hyphens or underscores. Avoid spaces.
- Add new pages under the appropriate `content/` subsection. Use nested folders to group related topics.
- Update `docs.json` to include new pages in navigation so they appear in the UI.
- Prefer relative links between pages. Example: `[Quickstart](../intro/quickstart)` from a nearby page.
- Store images under `images/` and reference them with relative paths from the MDX files.

## Adding a new page

1. Create the MDX file, e.g. `content/devs/example/new_feature.mdx`.
2. Add the page to the relevant `group` in `docs.json` under `navigation.dropdowns` (omit the `.mdx` extension):
   - `"content/devs/example/new_feature"`
3. Run `mintlify dev` to verify the page renders and appears in the sidebar.

## Changelog

Update `changelog.mdx` to record notable changes to the product or documentation.

## Deployment

This site is hosted on Mintlify. Typical deployment workflows are:

- Push to the default branch in the connected repository to trigger an automatic sync/build on Mintlify.
- Alternatively, publish from Mintlify Studio if enabled for your project.

If your organization uses a different release flow (e.g., CI to a static host), document it here.

## Contributions

- Create a feature branch for changes.
- Keep PRs focused and small where possible.
- Ensure local preview (`mintlify dev`) passes without warnings or errors.
- Include screenshots for visual changes when helpful.