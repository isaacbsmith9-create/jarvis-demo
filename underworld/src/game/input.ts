// Unified input: keyboard (desktop) + virtual joystick / buttons (touch).
// Mutable singleton read every frame by the game loop — no React re-renders.

export const input = {
  // analog stick from touch joystick, -1..1 (x = right, y = forward)
  stickX: 0,
  stickY: 0,
  stickActive: false,
  sprintTouch: false,
  actionTouch: false,
  // camera yaw delta accumulated from drag / Q,E
  camYawDelta: 0,
};

const keys = new Set<string>();

function onKeyDown(e: KeyboardEvent) {
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
}
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code);
}
function onBlur() {
  keys.clear();
}

let bound = false;
export function bindKeyboard() {
  if (bound) return;
  bound = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
}

export function isDown(code: string) {
  return keys.has(code);
}

/** Movement intent in camera space: x = strafe right, y = forward. Length <= 1. */
export function getMoveIntent(): { x: number; y: number; sprint: boolean } {
  let x = 0;
  let y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (input.stickActive) {
    x += input.stickX;
    y += input.stickY;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  const sprint =
    keys.has('ShiftLeft') || keys.has('ShiftRight') || input.sprintTouch ||
    (input.stickActive && Math.hypot(input.stickX, input.stickY) > 0.92);
  return { x, y, sprint };
}

/** Camera yaw input this frame (radians/sec for keys; drag accumulates directly). */
export function consumeCamYaw(dt: number): number {
  let d = input.camYawDelta;
  input.camYawDelta = 0;
  if (keys.has('KeyQ')) d += 2.2 * dt;
  if (keys.has('KeyE')) d -= 2.2 * dt;
  return d;
}

export function isActionHeld() {
  return keys.has('Space') || keys.has('KeyF') || input.actionTouch;
}
