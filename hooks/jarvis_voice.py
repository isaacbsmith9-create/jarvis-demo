#!/usr/bin/env python3
"""Jarvis voice for Claude Code — Stop hook.
Summarizes what Claude just did and speaks it via Fish Audio."""
import json, sys, os, subprocess, tempfile, urllib.request
from pathlib import Path

FISH_API_KEY = os.environ.get("FISH_API_KEY", "")
VOICE_ID     = os.environ.get("JARVIS_VOICE_ID", "")
MODEL        = "s2.1-pro-free"

def last_assistant_text(transcript_path):
    """Most recent assistant message from the session transcript."""
    text = None
    with open(transcript_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") != "assistant":
                continue
            content = entry.get("message", {}).get("content", "")
            if isinstance(content, list):
                parts = [b.get("text", "") for b in content
                         if isinstance(b, dict) and b.get("type") == "text"]
                text = "".join(parts).strip() or text
            elif isinstance(content, str):
                text = content.strip() or text
    return text

def summarize(text):
    """One spoken status line. Uses your existing Claude Code auth — no extra API key."""
    prompt = ("Summarize what was just done into ONE short spoken status line, "
              "as a calm British butler reporting to his principal. "
              "Address them as 'sir'. No preamble, no markdown, max 25 words.\n\n"
              + text[:4000])
    env = dict(os.environ, JARVIS_HOOK_ACTIVE="1")
    r = subprocess.run(["claude", "-p", "--model", "claude-haiku-4-5", prompt],
                       capture_output=True, text=True, timeout=45, env=env)
    out = (r.stdout or "").strip()
    return out[:300] if out else None

def speak(text):
    payload = {"text": text, "reference_id": VOICE_ID, "format": "mp3"}
    req = urllib.request.Request(
        "https://api.fish.audio/v1/tts",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {FISH_API_KEY}",
                 "Content-Type": "application/json",
                 "model": MODEL},
        method="POST")
    out = os.path.join(tempfile.gettempdir(), "jarvis_line.mp3")
    with urllib.request.urlopen(req, timeout=30) as resp, open(out, "wb") as f:
        f.write(resp.read())
    for cmd in (["afplay", out],                       # macOS
                ["ffplay", "-nodisp", "-autoexit", out],  # Linux/anything with ffmpeg
                ["mpg123", out]):
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
            return
        except FileNotFoundError:
            continue

def main():
    if os.environ.get("JARVIS_HOOK_ACTIVE"):   # don't voice the summarizer's own run
        return
    if not FISH_API_KEY or not VOICE_ID:
        return
    try:
        hook = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        return
    if hook.get("stop_hook_active"):
        return
    tp = hook.get("transcript_path")
    if not tp or not Path(tp).exists():
        return
    text = last_assistant_text(tp)
    if not text:
        return
    try:
        line = summarize(text) or "Task complete, sir."
        speak(line)
    except Exception:
        pass  # a voice hiccup should never block Claude Code

if __name__ == "__main__":
    main()
