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
| Student Lens | `sl-data` { updatedAt, state } (its whole backup minus uploaded file bodies). Publishes `life-school` (read-only for everyone else) { sl:true, gpa {unweighted,weighted}, classes [{id,name,teacher,period,level,core,color,active,slPct,letter}], items [{id,title,cls,type: hw/quiz/test/exam/project/essay/other,due,time,mins,done}], grades [{id,cls,cat: test/quiz/hw,title,score,max,date}], snaps {date: gpa} } | calendar, signals |
| Gameplan / Life OS | `gp-*` (`gp-core`, `gp-d-YYYY-MM-DD`, `gp-sig`); later `life-*` | `aos-plan` calendar events, signals |
| Recovery Lens (`recovery.html`) | `rl`, `rl-*` (sleep, check-ins, body map, protocols, readiness, baselines, AI, games, injuries); also `feel.sleepH/energy/sore/fatigue` and sessions (`source: 'recovery-lens'`) in `day-*` | meals, water, targets, workouts, calendar |
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
`Suite.mount(el, '<app id>', () => save())`. App ids: `aos`, `gp`, `school`, `btc`, `ml`. App id `school` is Student Lens (`student.html` with `app.css`, `js/`, `vendor/` beside it; source `vendor/student-lens`, bridge `src/suite/sl-bridge.js`). `school.html` forwards to `student.html`. Its data stays in IndexedDB `student-lens` on the device and syncs through `sl-data`; when `life-school.sl` is set, the Athlete OS School tab is read-only and uses `slPct` and `gpa`.
Theme: one setting for all pages, stored under `macrolens-theme`.

## How the Training Center is bundled

`vendor/btc.html` is its published page, unchanged except: storage key `ml:btc-local`, account doc `btc-app`, and the
brand line replaced by the switcher. `src/suite/btc-skin.css` restyles it; `src/suite/btc-bridge.js` exports each
finished session once (id `btc-<session id>`, type from the session's main area, RPE = average drill difficulty × 2,
minutes from the session) and adds Athlete OS context (games, practices, load ratio > 1.3, readiness < 45) to its
daily recommendation. To pick up a new Training Center version, replace `vendor/btc.html` and rebuild; the build
stops with a clear error if one of those anchors changed.

## Event stream (ecosystem phase 1)

`src/events.js` turns every app's own records into one stream of events, so no app has to change to appear in it.
Each event: `{ id, app: aos|gp|school|btc|ml, type: '<kind>.<verb>', date: 'YYYY-MM-DD', time: 'HH:MM' | null, title, detail }`.
Ids are stable (built from the record's own id or date), so re-reading never duplicates an event.

| App | Events read from its records |
| --- | --- |
| MacroLens | `meal.logged` (per meal), `water.logged`, `weight.logged` |
| Training Center | `workout.finished` (exported sessions, `source: 'training-center'`) |
| Athlete OS | `workout.finished`, `recovery.checkin`, `mind.checkin`, `test.result`, `record.set`, `shooting.session`, `game.played`, `goal.milestone` |
| Gameplan | `block.done`, `night.done` |
| School | `grade.posted`; upcoming `due.<type>` items for "Coming up" |

For something an app's records can't show, the app appends to **its own** `ev-<app>` doc
(`{ events: [{ id, type, date, time, title, detail }] }`, newest 300 kept). In Athlete OS: `Ecosystem.emit(type, title, detail)`.
Read the stream with `Ecosystem.events(from, to)` and `Ecosystem.upcoming(days)`. Shown in Intel › Timeline and the
Home card "Across your apps". Later phases (inbox, automations, assistant) build on this stream.

## Hub (index.html, the artifact's front page; Athlete OS is athlete.html)

The ecosystem app: the Athlete OS bundle in `APP_MODE = 'hub'`, switcher id `hub`. It owns no data. It reads every
app's records and the event stream to show one launcher (a live number per app), one agenda (calendar + Gameplan),
"Needs attention" from every app, cross-app graphs (life balance, app pulse, activity, training, nutrition, sleep,
mind, planning, school) and the Timeline. Code: `src/ecohub.js`.

## Recovery Lens (recovery.html)

`vendor/recovery.html` is its published page. The build only changes its app list (adds Hub, Athlete OS → `athlete.html`).
It detects the bundle itself (`macrolens.html` exists) and then reads the shared records. Hub shows its stored readiness
(`rl-ready`), pain flags (`rl-body`) and protocols (`rl-proto`), and the event stream attributes its records to app `rl`.

## Day-record safety (src/suite/daymerge.js)
Every page loads a merge layer under its database before its own scripts. Saving a `day-YYYY-MM-DD` doc reads the account
copy first and merges three ways against what that page last loaded: fields and id'd list items the page changed win;
everything it did not touch keeps the account's value (including items other apps or devices added). Apps keep saving
whole docs as before. Lists inside day docs should give each item an `id` so they merge item by item.

## Readiness owner (src/unify.js)
Recovery Lens owns readiness. When `rl-ready.days[date].score` exists it is both `readiness(date).score` and
`recoveryScore(date).score` everywhere in the bundle; Athlete OS adjustments (load spike, fatigue, injury) become notes.
Days without it use Athlete OS's own calculation.

## Quick capture (src/capture.js)
Hub › Today box. Student Lens items go to doc `sl-inbox` { items [{id, kind: assignment|exam, classId, title, type, date,
time, at, done}] } and to `life-school.items` (pending:true) right away; Student Lens adds them when it opens and sets
`done`. Training goes to `aos-plan` events, tasks to `gp-core.tasks`, food opens MacroLens with the text copied.

## Hub 2.0 Phase A (src/phasea.js)
- **One summary format:** `Ecosystem.signals()` returns, for every app, `{ app, name, color, href, updated, stale,
  metrics: [{k, label, v, unit}], flags: [text] }`, built from what each app already publishes. New code reads apps
  through it, not their raw docs.
- **One check-in:** Recovery Lens owns the morning check-in. Athlete OS's check-in buttons open `recovery.html#morning`,
  which goes straight to it.
- **One goals list:** `aos-goals` is the shared list. Extra auto sources: `school:gpa`, `school:wgpa`,
  `school:cls:<class id>`, `rl:ready7`, `nut:pdays7`. Hub › Goals shows it. GPA and class-grade goals are mirrored into
  Student Lens's goals as `hub-<goal id>` (read-only copies; edit them in the Hub or Athlete OS).
