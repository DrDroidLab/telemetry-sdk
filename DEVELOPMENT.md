# Local Development with `yalc`

This guide explains how to use [`yalc`](https://github.com/wclr/yalc) for local development and testing of `@hyperlook/telemetry-sdk` in another app (e.g., `crossword-next`).

## Why use yalc?

- **No more `npm link` headaches**: yalc is more reliable for local package development.
- **Test changes instantly**: Push SDK changes to your app without publishing to npm.

---

## 1. Install yalc (if you haven't already)

```bash
npm install -g yalc
```

---

## 2. Build the SDK (in telemetry-sdk)

```bash
cd /Users/jayeshsadhwani/projects/telemetry-sdk
pnpm install # or npm install / yarn install
pnpm run build # or npm run build / yarn build
```

---

## 3. Publish the SDK to your local yalc store

```bash
yalc publish --push
```

- The `--push` flag will automatically update all linked projects.

---

## 4. Add the SDK to your app (e.g., crossword-next)

In a **separate terminal/tab**:

```bash
cd /Users/jayeshsadhwani/projects/crossword-next
yalc add @hyperlook/telemetry-sdk
pnpm install # or npm install / yarn install
```

---

## 5. Use the SDK in your app

Import and use as normal:

```js
import { initTelemetry } from "@hyperlook/telemetry-sdk";
```

---

## 6. Development Workflow

- **Make changes** in `telemetry-sdk`.
- **Rebuild** the SDK:
  ```bash
  pnpm run build
  ```
- **Re-publish** to yalc (auto-pushes to app):
  ```bash
  yalc publish --push
  ```
- **Restart** your app's dev server if needed (sometimes hot reload is enough).

---

## 7. Remove yalc link (when done)

In your app directory:

```bash
yalc remove @hyperlook/telemetry-sdk
pnpm install # or npm install / yarn install
```

---

## 8. Troubleshooting

- If you see duplicate React errors, make sure only one copy of React is installed in your app.
- If changes don't show up, try restarting your app's dev server.
- If you see type errors, ensure your SDK is built and type files are present in `dist/`.

---

## 9. Pro Tips

- You can link to multiple apps: just run `yalc add @hyperlook/telemetry-sdk` in each one.
- Use `yalc push` in the SDK directory to update all linked apps after a build.
- Add `yalc.lock` and `.yalc/` to your `.gitignore` in consumer apps.

---

Happy hacking!
