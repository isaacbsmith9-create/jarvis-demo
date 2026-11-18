# Athlete suite data contract

All apps in the bundle (Athlete OS, Gameplan / Life OS, MacroLens, and the Basketball Training Center when it joins) are
pages of **one artifact**, so they share one database: this device's `localStorage` (keys prefixed `ml:`) and the Claude
account collection `data/users/<user id>`.

## Rules

1. **Each app writes only its own records.** It reads other apps' records read-only.
2. **To change another app's data, link to that app** (like "Edit in Gameplan ›"). Never edit it in place.
3. **Save before leaving.** The suite switcher calls the page's save (`flush`) before navigating.
4. **Hypothetical data never goes into real records.** (Lab simulations live in `aos-sim` only.)

## Who owns what

| App | Owns (writes) | Reads |
| --- | --- | --- |
| Athlete OS | `aos`, `aos-*` (tests, shots, games, body, coach, plan, goals, mind, intel, sim, signals) and **workouts** in `day-*` | Gameplan blocks, MacroLens meals, signals |
| MacroLens | `core`, meals / water / feel in `day-*` (and game-day workouts it logs) | workouts in `day-*` |
| Gameplan / Life OS | `gp-*` (`gp-core`, `gp-d-YYYY-MM-DD`, `gp-sig`); later `life-*` | `aos-plan` calendar events, signals |
| Basketball Training Center | `btc-app` (its whole state: drills, workouts, plan, sessions, journal…), `btc-sync` (which sessions were exported), `btc-sig`, and **finished sessions as workouts** in `day-*` | `aos-signals` (load ratio, readiness), `aos-plan` (games, practices), `aos`, `core` |

## Workout format (how a finished session counts in load, analytics and the Lab)

Append one entry to `day-YYYY-MM-DD` → `exercise[]` (create the day doc if missing with
`{ breakfast: [], lunch: [], dinner: [], snacks: [], water: 0 }`):

```json
{
  "id": "btc-<unique>",
  "type": "shooting | handles | finishing | skill | lift | conditioning | practice | game | recovery",
  "name": "Elite guard shooting block",
  "mins": 60,
  "int": "light | moderate | hard",
  "rpe": 7,
  "time": "16:30",
  "kcal": 0,
  "addedAt": 1700000000000,
  "source": "training-center",
  "btc": { "workoutId": "...", "drills": [{ "id": "...", "name": "...", "made": 42, "att": 60 }] }
}
```

- `type` decides the load category. `rpe` (1–10) is preferred; without it `int` maps to 3 / 5 / 7.
- Session load = `mins × rpe`.
- Use a stable `id` and replace your own entry on re-save, so a session is never counted twice.

## Signals (one small weekly summary per app, read by the others)

| Doc | Written by | Fields |
| --- | --- | --- |
| `aos-signals` | Athlete OS | `week` (Monday), `acuteLoad`, `chronicLoad`, `acwr`, `readiness`, `trainDays`, `trainMins`, `plannedByDay`, `nextGame` |
| `gp-sig` | Gameplan | `week`, `busyMinsByDay`, `schoolMinsByDay`, `openTasks`, `top3Today`, `bed`, `wake` |
| `btc-sig` | Training Center | `week`, `sessionsDone`, `minsByArea7d`, `nextPlanned` |

Signals are rewritten only when something changed.

## App switcher

Every page mounts the same switcher in place of its brand:
`Suite.mount(el, '<app id>', () => save())`. App ids: `aos`, `gp`, `btc`, `ml`.
Theme: one setting for all pages, stored under `macrolens-theme`.

## How the Training Center is bundled

`vendor/btc.html` is its published page, unchanged except: storage key `ml:btc-local`, account doc `btc-app`, and the
brand line replaced by the switcher. `src/suite/btc-skin.css` restyles it; `src/suite/btc-bridge.js` exports each
finished session once (id `btc-<session id>`, type from the session's main area, RPE = average drill difficulty × 2,
minutes from the session) and adds Athlete OS context (games, practices, load ratio > 1.3, readiness < 45) to its
daily recommendation. To pick up a new Training Center version, replace `vendor/btc.html` and rebuild; the build
stops with a clear error if one of those anchors changed.
