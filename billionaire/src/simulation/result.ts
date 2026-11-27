export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}
export const ok = (message: string, id?: string): ActionResult => ({ ok: true, message, id });
export const fail = (message: string): ActionResult => ({ ok: false, message });
