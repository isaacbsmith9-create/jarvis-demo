# Jarvis voice hook

A global Claude Code `Stop` hook: after any Claude Code session (in any project,
not just this one) finishes a turn, it summarizes what happened into one line and
speaks it out loud via Fish Audio. This is separate from `server.js` — that's the
in-browser talk-to-Claude demo; this is a narrator for your normal terminal usage
of Claude Code.

`server.js` disables hooks for the sessions it spawns (`claude-settings.json`'s
`disableAllHooks`) specifically so this hook — if you've installed it — doesn't
double-narrate over the demo's own voice.

## 1. Get a free Fish Audio API key

1. Sign up at [fish.audio](https://fish.audio)
2. Open **API Keys** (fish.audio/app/api-keys), not the playground
3. Generate a key and copy it

## 2. Pick a voice

Every voice in Fish's library has its ID in the URL: open **Discovery**, click a
voice, and the ID is the string after `fish.audio/m/`.

## 3. Export the key and voice ID

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export FISH_API_KEY="paste-your-key-here"
export JARVIS_VOICE_ID="paste-voice-id-here"
```

## 4. Install the hook

```bash
mkdir -p ~/.claude/hooks
cp hooks/jarvis_voice.py ~/.claude/hooks/jarvis_voice.py
```

Then add the `Stop` entry to `~/.claude/settings.json` (create the file if it
doesn't exist; merge this into an existing `hooks` block if you have one):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/jarvis_voice.py",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

## 5. Test it

Open a fresh terminal (so the exports load), start Claude Code anywhere, give it
any small task. When it finishes, it speaks.

## Troubleshooting

- **No audio on Linux:** install ffmpeg (`sudo apt install ffmpeg`) — macOS needs
  nothing, `afplay` is built in.
- **Silent, no errors:** confirm both exports landed in the terminal you launched
  Claude Code from — `echo $FISH_API_KEY` and `echo $JARVIS_VOICE_ID`.
- **Wrong or weird voice:** the voice ID is the string after `/m/` in the voice
  page URL — no slashes, no spaces.
- **It talks too much / too little:** adjust the `max 25 words` line in
  `jarvis_voice.py`'s `summarize()` prompt.
