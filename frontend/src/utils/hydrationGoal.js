export function calculateDailyGoal(weightKg, ageYears, gender) {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w < 1) return { amount: 2000, factor: 33, added: 0 };
  
  let factor = 33;
  const a = Number(ageYears);
  if (Number.isFinite(a) && a > 0) {
    if (a < 30) factor = 40;
    else if (a >= 30 && a <= 55) factor = 35;
    else factor = 30;
  }
  
  let raw = Math.round(w * factor);
  let added = 0;
  
  if (gender === 'male') {
    added = 400;
    raw += added;
  }
  
  const amount = Math.min(6000, Math.max(1000, raw));
  return { amount, factor, added };
}
