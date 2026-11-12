# MacroLens

A food diary and macro tracker (in the style of classic calorie-counting apps) **plus** AI photo scanning: snap your plate and Claude identifies each food, estimates portions, and logs calories + macros.

## Features

| Feature | How it works |
|---|---|
| 📸 **Photo scan** | Upload/snap a meal → Claude vision returns itemized foods, portions (grams), calories, P/C/F, and a confidence level for each. You can edit everything before logging. |
| 💬 **Describe** | Type "2 eggs, toast with butter, OJ" → AI estimate, same review screen. |
| 🔍 **Search** | 75 built-in foods (athlete staples) + millions of branded foods from Open Food Facts. Recents and custom foods show first. |
| ▥ **Barcode** | Camera scan on Chrome/Android (BarcodeDetector), or type the digits. |
| ⚡ **Quick add** | Enter calories/macros directly; optionally save as a custom food. |
| 🎯 **Targets** | Mifflin-St Jeor BMR × activity → calories; protein 0.9–1 g/lb, fat 27%, carbs fill the rest. Goals: slow cut (−400), maintain, lean bulk (+300). Manual overrides for coach-given numbers. |
| 📈 **Progress** | Logging streak, 7-day calorie chart vs goal, macro averages, weight trend (logging weight re-computes targets). |
| 💧 **Water** | Daily water goal and quick +8/+16 oz buttons. |
| 💾 **Data** | Stored on your device (localStorage). Export/import JSON backups. |

## Run it

```bash
cd macrolens
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # enables photo scan + describe
npm start                             # http://127.0.0.1:5173
```

Without a key, everything except the AI features still works.

**Use it on your phone:** run with `HOST=0.0.0.0 npm start`, then open `http://<your-computer's-LAN-IP>:5173` on your phone (same Wi-Fi). "Add to Home Screen" installs it like an app. Note: browsers only allow live camera *barcode* scanning on HTTPS or localhost; the photo upload and typed barcode work everywhere.

## Config

| Env var | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for AI scanning |
| `MACROLENS_MODEL` | `claude-opus-5-5` | Model used for scans |
| `PORT` / `HOST` | `5173` / `127.0.0.1` | |

AI requests use structured JSON output (schema-validated), low effort for speed, and server-side refusal fallback. The server also sanity-checks results (clamps values, and if calories don't match the macros by >25% it trusts the macros).

## Tests

```bash
npm test
```

## Layout

```
server.js               HTTP server + JSON API (stateless)
lib/nutrition.js        targets, totals, streak math (shared with the browser)
lib/foods.js            built-in food database + search
lib/openfoodfacts.js    barcode + branded food lookup
lib/ai.js               Claude vision meal analysis
public/                 the app (vanilla JS, no build step)
```

## Ideas for v2
- Accounts + cloud sync (diary is device-only right now)
- Saved meals / "log yesterday's breakfast again"
- Micronutrients (sodium, sugar, iron, calcium)
- Training-day vs rest-day calorie targets
