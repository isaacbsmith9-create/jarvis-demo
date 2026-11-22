// ===================== One readiness score =====================
// Recovery Lens owns readiness. When it has scored a day (doc "rl-ready"), that number is the readiness AND recovery
// score everywhere in this bundle (Hub, Athlete OS, Command Center, signals sent to the Training Center).
// Athlete OS's own adjustments (load spike, fatigue, injury) stay as notes next to it instead of changing the number.
// Days without a Recovery Lens score fall back to Athlete OS's own calculation, as before.
const rlReadyOn = (d) => doc('rl-ready')?.days?.[d]?.score ?? null;
const _aosRecovery = recoveryScore, _aosReadiness = readiness;
recoveryScore = function (date) {
  const rl = rlReadyOn(date), o = _aosRecovery(date);
  if (rl == null) return o;
  return { ...(o || { parts: [], inputs: recoveryInputs(date) }), score: rl, aosScore: o?.score ?? null, src: 'Recovery Lens' };
};
readiness = function (date = todayIso()) {
  const rl = rlReadyOn(date);
  if (rl == null) return _aosReadiness(date);
  const o = _aosReadiness(date);
  return { score: rl, base: recoveryScore(date), notes: (o?.notes || []).map((n) => n.replace(/\s*\([-+]\d+\)\s*$/, '')), src: 'Recovery Lens' };
};
