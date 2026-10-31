export type Difficulty = "cruise" | "arcade" | "overdrive";
export type Item = { lane: number; z: number; kind: "block" | "energy" | "shield"; taken?: boolean; resolved?: boolean };
export type Run = {
  lane: number; visualLane: number; distance: number; energy: number; shield: number;
  items: Item[]; spawn: number; boost: number; flash: number; bonus: number;
  streak: number; maxStreak: number; nearMisses: number; seconds: number;
  missions: boolean[]; boostLocked: boolean; difficulty: Difficulty;
};
export type RunEvent = { kind: "energy" | "shield" | "impact" | "crash" | "near" | "mission" | "sector"; lane: number; text: string };
export const DIFFICULTIES = {
  cruise: { label: "Balade", speed: 145, spacing: 1.65, description: "Plus de temps pour trouver votre rythme." },
  arcade: { label: "Arcade", speed: 180, spacing: 1.25, description: "Le bon équilibre entre flow et réflexes." },
  overdrive: { label: "Expert", speed: 230, spacing: 1.05, description: "Une ville rapide. Aucune hésitation." },
};
export const SECTORS = [
  { name: "NEO TOKYO", color: "#a18aff", sky: "#171331", subtitle: "Lumières dans la nuit" },
  { name: "SAKURA DISTRICT", color: "#ff80ba", sky: "#31132b", subtitle: "Au-delà des lumières" },
  { name: "ION HARBOR", color: "#64dfeb", sky: "#0c2a35", subtitle: "L’horizon électrique" },
];
export const createRun = (difficulty: Difficulty = "arcade"): Run => ({
  lane: 1, visualLane: 1, distance: 0, energy: 0, shield: 0, items: [], spawn: .5,
  boost: 100, flash: 0, bonus: 0, streak: 0, maxStreak: 0, nearMisses: 0,
  seconds: 0, missions: [false, false, false], boostLocked: false, difficulty,
});
export const levelOf = (r: Run) => 1 + Math.floor(r.distance / 650);
export const multiplierOf = (r: Run) => Math.min(4, 1 + Math.floor(r.streak / 3));
export const scoreOf = (r: Run) => Math.floor(r.distance) + r.bonus;
export const missionProgress = (r: Run) => [Math.min(8, r.energy), Math.min(1000, Math.floor(r.distance)), Math.min(4, r.nearMisses)];
export function snapshot(r: Run, boosting = false) {
  return { score: scoreOf(r), energy: r.energy, speed: DIFFICULTIES[r.difficulty].speed + Math.min(levelOf(r) - 1, 10) * 18 + (boosting ? 120 : 0), boost: r.boost, shield: r.shield, level: levelOf(r), streak: r.streak, maxStreak: r.maxStreak, multiplier: multiplierOf(r), nearMisses: r.nearMisses, seconds: r.seconds, missions: [...r.missions], progress: missionProgress(r), boostLocked: r.boostLocked };
}

/** Advances simulation only; rendering and browser effects live in the component. */
export function stepRun(r: Run, dt: number, boostHeld: boolean, random = Math.random) {
  const events: RunEvent[] = [], oldLevel = levelOf(r), oldLane = r.visualLane;
  if (!boostHeld) r.boostLocked = false;
  const boosting = boostHeld && !r.boostLocked && r.boost > 0;
  const speed = DIFFICULTIES[r.difficulty].speed + Math.min(oldLevel - 1, 10) * 18 + (boosting ? 120 : 0);
  r.seconds += dt; r.distance += dt * speed / 7;
  r.boost = Math.max(0, Math.min(100, r.boost + dt * (boosting ? -33 : 12)));
  if (r.boost === 0) r.boostLocked = true;
  r.shield = Math.max(0, r.shield - dt); r.flash = Math.max(0, r.flash - dt);
  r.visualLane += (r.lane - r.visualLane) * Math.min(1, dt * 16);
  r.spawn -= dt;
  if (r.spawn <= 0) {
    const blockedLane = Math.floor(random() * 3), safeLane = (blockedLane + 1 + Math.floor(random() * 2)) % 3;
    r.items.push({ lane: blockedLane, z: 0, kind: "block" });
    if (oldLevel >= 3 && random() < .35) r.items.push({ lane: 3 - blockedLane - safeLane, z: 0, kind: "block" });
    const kind = random() < .13 ? "shield" : "energy";
    r.items.push({ lane: safeLane, z: -.1, kind });
    if (kind === "energy") r.items.push({ lane: safeLane, z: -.22, kind: "energy" });
    // Keep enough time to cross two lanes, even at higher speeds and under boost.
    r.spawn = Math.max(.82, DIFFICULTIES[r.difficulty].spacing - oldLevel * .025);
  }
  let crashed = false;
  for (const item of r.items) {
    const previousZ = item.z;
    item.z += dt * speed / 470;
    if (item.resolved || item.z < .96) continue;
    item.resolved = true;
    const crossing = Math.max(0, Math.min(1, (.96 - previousZ) / (item.z - previousZ)));
    const playerLane = oldLane + (r.visualLane - oldLane) * crossing;
    const separation = Math.abs(item.lane - playerLane);
    if (separation < .48) {
      item.taken = true;
      if (item.kind === "energy") {
        r.energy++; r.streak++; r.maxStreak = Math.max(r.maxStreak, r.streak);
        const points = 50 * multiplierOf(r); r.bonus += points;
        events.push({ kind: "energy", lane: item.lane, text: `+${points} · COMBO ×${multiplierOf(r)}` });
      } else if (item.kind === "shield") {
        r.shield = 6; events.push({ kind: "shield", lane: item.lane, text: "BOUCLIER ACTIVÉ" });
      } else if (r.shield > 0) {
        r.shield = 0; r.flash = .35; r.streak = 0;
        events.push({ kind: "impact", lane: item.lane, text: "IMPACT ABSORBÉ" });
      } else { crashed = true; events.push({ kind: "crash", lane: item.lane, text: "SIGNAL PERDU" }); break; }
    } else if (item.kind === "energy") r.streak = 0;
    else if (item.kind === "block" && separation < 1.12) {
      r.nearMisses++; r.bonus += 25;
      events.push({ kind: "near", lane: item.lane, text: "ESQUIVE PARFAITE +25" });
    }
  }
  r.items = r.items.filter(item => item.z < 1.2);
  const completed = [r.energy >= 8, r.distance >= 1000, r.nearMisses >= 4];
  completed.forEach((done, i) => {
    if (done && !r.missions[i]) { r.missions[i] = true; r.bonus += 300; events.push({ kind: "mission", lane: r.lane, text: "MISSION ACCOMPLIE +300" }); }
  });
  if (levelOf(r) > oldLevel) events.push({ kind: "sector", lane: r.lane, text: `SECTEUR ${String(levelOf(r)).padStart(2, "0")} · ${SECTORS[(levelOf(r) - 1) % SECTORS.length].name}` });
  return { events, crashed, boosting };
}
