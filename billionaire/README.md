# BILLIONAIRE — Alpha 0.2 (Miami)

A business-empire and underworld simulation. Start with $500 or a fortune, build companies across four industries, buy and develop property in an isometric Miami, compete with simulated rivals, and save your empire locally.

Everything runs in the browser. There is no server, no external API and no paid service. Saves live in IndexedDB.

## Run it

```bash
cd billionaire
npm install
npm run dev          # http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-check and build a static site into `dist/` (deployable to any static host, e.g. GitHub Pages) |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm test` | Simulation, ledger, determinism and save tests (Vitest) |
| `npm run e2e` | Browser smoke test against the preview server (needs Playwright + Chromium) |

## Controls

- **Space**: pause / resume. **1 / 2 / 3**: speeds. **0**: pause. **N**: advance one day while paused.
- **⌘/Ctrl + S**: quick save to Slot 1. The game also autosaves on the 1st of every month.
- **City**: drag to pan, scroll to zoom, WASD / arrow keys. Click a building to inspect it, or click the ground to inspect a district.

## The gameplay loop

1. Choose one of **11 backgrounds** (6 legitimate, 5 underground). Each has its own balance sheet, liabilities, relationships, advantages, disadvantages and objective.
2. **Inspect Miami**: 6 districts, 47 named properties and about 300 lots. Each district has different traffic, affluence, tourism, nightlife, tech scene, prices and costs.
3. **Buy, lease, rent out, renovate or sell** property.
4. **Found a company** in one of 4 industries (10 business types), at home, in a leased space or in a building you own.
5. **Hire staff** from a weekly candidate pool. Staff have skill, performance, loyalty and traits. You can give raises, train or fire them, or work in the business yourself.
6. **Run time**: daily revenue and costs flow through the ledger, and monthly statements roll up.
7. **Review** the dashboards, P&L, balance sheet and ledger. Then **expand**: raise prices, market, delegate to a manager, borrow, or open more companies.
8. **Save** to one of 5 slots plus autosave, or export and import a save file.

## Industries (each runs on its own model)

| Industry | Business types | Model |
| --- | --- | --- |
| Real estate | Brokerage + direct property holding | Random deal flow earns commissions (agents take 40%). Property managers raise occupancy and rent across your rentals for an 8% fee. RE companies can buy and hold property. |
| Technology | Software agency, SaaS | Agency: billable hours × rate, capped by client demand (sales staff). SaaS: quality grows with engineering. Users come from marketing (CAC rises with spend) and organic growth. Churn depends on quality, support and price. Hosting cost scales per user. |
| Hospitality | Restaurant, hotel, nightclub, food truck | Seats, kitchen, service, housekeeping or security staff cap capacity. Demand varies by weekday and Miami season, and by district. Nightclubs open Thursday–Sunday. Food trucks park in the best district each day. |
| Retail | Boutique, convenience, online | Inventory is bought from suppliers and restocks automatically to a target. Markup × price level sets shelf price. Stock-outs hurt reputation. Online stores are driven by marketing and pay shipping. |

## Architecture

```
src/
  types/core.ts            All entity types (money is integer cents)
  data/                    Static content: districts & map layout, properties, industries, roles, rivals, scenarios
  simulation/              Pure TypeScript, no React/Phaser
    engine.ts              Deterministic daily step (order of operations)
    finance/ledger.ts      transfer(): the only function that moves money
    finance/valuation.ts   Company valuation, balance sheet, net worth
    finance/loans.ts       Credit offers, borrowing, repayment, monthly debt service
    companies/             Founding, daily operations, staff actions, industry rules
    properties/            Valuation, rent, occupancy, buy/sell/lease/renovate
    employees/             Candidates, effectiveness, loyalty and performance drift
    competitors/           Rival companies: weekly decisions, acquisitions, price wars, bankruptcy
    economy/               Market index, rates, district demand, seasonality, modifiers
    events/                News feed and random world events with real effects
    organizations/         Underground organization foundation (abstract & fictional)
    objectives.ts, newGame.ts
  persistence/             IndexedDB slots, versioned schema, validation, migrations, import/export
  game/                    Phaser 3: procedural isometric city + office interior scene
  app/                     Store (clock, actions, notifications) and game shell
  features/                React screens: dashboard, city, companies, property, staff, finance, market, news, network, saves
  components/              UI kit and SVG charts (always driven by real data)
```

Design rules the code follows:

- **The simulation is deterministic.** All randomness comes from a seeded RNG whose state is part of the save, so the same seed and the same actions give the same game. `tests/simulation.test.ts` checks this.
- **Money is never created or deleted silently.** Every movement is a double-entry ledger transaction between accounts (`player`, `co:*`, `rival:*`, `org:*` and `world`). Tests check that every account balance reconciles with the ledger after 300 simulated days in every scenario. The ledger keeps a rolling window of 6,000 entries, and older entries are summarized by category rather than dropped.
- **Saves are versioned.** `persistence/schema.ts` validates structure and references, and refuses saves made by a newer version. `MIGRATIONS` is where future schema upgrades go. Corrupted saves show up as unloadable in the save list instead of crashing the game.
- **Rendering is cheap.** All city art is drawn once into cached textures and then rendered as batched sprites. Buildings are generated a few per frame, so the UI never freezes. The city's render loop sleeps while you're on another screen, and the frame rate is capped at 40 fps.

## Alpha 0.2 additions

- **Multiple locations.** Each company is made of branches, and each branch has its own premises, staff, operations and costs. You can open new locations (60% of a first fit-out), move a location to a bigger or better property, close one (its staff transfer where there's room), and hire or transfer staff per location. SaaS companies stay single-office.
- **Business-for-sale market.** Independent Miami businesses run in the same simulation as yours. After 21 days of trading they're listed with real financials, so you can judge them before buying. Asking prices track each business's valuation, and sellers get more flexible over time. Buy one to take over its staff, stock and lease.
- **Investing.** Buy minority stakes (up to 49%) in rival companies, earn 35% of each profitable month as a dividend, and sell at 92% of the current valuation. A stake is lost if the rival goes bankrupt.
- **Executives.** Hire a COO (raises staff performance everywhere and can run delegated companies), a CFO (lower loan rates and an optional weekly cash sweep), and a CMO (stronger marketing, cheaper acquisition). They're paid from your personal cash, and their loyalty depends on pay.
- **Saves.** Five campaign slots, autosaved, kept in your claude.ai account. Save schema v2 upgrades v1 saves automatically.

## Alpha 0.1 status

**Working**
- Main menu, new campaign and all 11 backgrounds with explicit starting balance sheets and objectives
- Isometric Miami: 6 districts, ownership, for-sale and for-lease markers, hover, selection, district inspector, filters, zoom and pan, live traffic and boats
- Property: buy (personally or through an RE company), rent out, renovate, sell, lease for a business, transfer to a company
- Companies in all 4 industries, with pricing, marketing, restock targets, owner-operator mode, manager delegation, capital injection and withdrawal, closure, distress and forced closure
- Staff: hiring pool, raises, training, firing, loyalty-driven quitting, poaching events
- Finance: cash, net worth, balance sheet, monthly statements, a paginated and filterable ledger, bank credit, scenario debts and missed-payment consequences
- 10 competitors that buy property, cut prices, lay off staff, expand and can go bankrupt
- Economy index, interest rates, district demand and price indexes, seasonality, 12 random event types
- Underground organization foundation: treasury, members, influence, heat, posture, investigations, transfers
- Office/venue interior (Phaser) showing the company's actual employees; click one to open their profile
- Save and load across 5 slots, monthly autosave, export and import

**Planned for future releases** (marked in the game where relevant, never faked)
- Underground missions, territory expansion, alliances, disputes and story-driven investigations
- Relationship events and character interactions with contacts
- Full takeovers of rival companies, and rivals making offers for yours
- Development of new buildings
- Supply chains, product development, marketing campaigns
- More cities and international expansion

## Known issues / limitations

- Office interiors share one layout for every business type, with different furnishing colours by industry.
- Ledger history beyond the last 6,000 transactions is kept only as category totals.
- On machines without GPU acceleration the city renders at a reduced frame rate (simulation speed is unaffected).

All businesses, people, organizations and properties are fictional. Property names are invented for gameplay and are not real listings.
