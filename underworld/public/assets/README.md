# UNDERWORLD art assets

Everything in the slice is drawn in code. To swap in generated art:

1. Put the file in the matching folder here (`ui/`, `textures/`, `models/`, `audio/`).
2. Add its path (relative to `/assets/`) to `manifest.json`, e.g.
   `{ "files": ["ui/sign_club.png"] }`.
3. Reload. Listed files replace the placeholder; unlisted files are ignored.

## Expected filenames

| File | Used for | Size |
| --- | --- | --- |
| `ui/sign_laundromat.png` | Lucky Star Laundromat storefront sign | 512x128 |
| `ui/sign_taqueria.png` | Marisol Taqueria sign | 512x128 |
| `ui/sign_pawn.png` | Vito's Pawn & Loan sign | 512x128 |
| `ui/sign_arcade.png` | Golden Reel Arcade sign | 512x128 |
| `ui/sign_liquor.png` | Dos Rios Liquor sign | 512x128 |
| `ui/sign_chopshop.png` | Harbor Chop Shop sign | 512x128 |
| `ui/sign_club.png` | Neon Palms Club sign | 512x128 |
| `ui/sign_hotel.png` | Hotel Bellaventura sign | 512x128 |
| `textures/facade.png` | Building window tile (4x4 windows, near-white walls get tinted) | 512x512 |
| `textures/facade_emissive.png` | Lit-window mask for the facade tile (black = unlit) | 512x512 |
| `textures/asphalt.png` | Road surface, tiles every 8 m | 256x256 |
