// Swappable art. Drop files into /public/assets and list them in
// /public/assets/manifest.json — listed files replace the code-drawn
// placeholders at runtime. Unlisted files are never requested, so a
// missing asset never produces a 404 or a broken material.

import { useEffect, useState } from 'react';
import * as THREE from 'three';

let manifest: Set<string> | null = null;
let pending: Promise<Set<string>> | null = null;

function loadManifest(): Promise<Set<string>> {
  if (manifest) return Promise.resolve(manifest);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}assets/manifest.json`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((j: { files?: string[] }) => new Set((j.files ?? []).map((f) => (f.startsWith('/') ? f : `/assets/${f}`))))
      .catch(() => new Set<string>())
      .then((s) => (manifest = s));
  }
  return pending;
}

const loader = new THREE.TextureLoader();

/** Returns the code-drawn fallback immediately, swapping in the file if the manifest lists it. */
export function useSwappableTexture(url: string | undefined, fallback: () => THREE.Texture) {
  const [tex, setTex] = useState<THREE.Texture>(fallback);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    loadManifest().then((m) => {
      if (!alive || !m.has(url)) return;
      loader.load(
        url,
        (t) => {
          if (!alive) return;
          t.colorSpace = THREE.SRGBColorSpace;
          setTex(t);
        },
        undefined,
        () => { /* keep fallback on load error */ },
      );
    });
    return () => { alive = false; };
  }, [url]);
  return tex;
}
