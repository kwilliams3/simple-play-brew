import { describe, expect, it } from "vitest";
import { createRun, multiplierOf, scoreOf, snapshot, stepRun } from "@/lib/neon-engine";

function emptyRun() { const run = createRun(); run.spawn = 999; return run; }

describe("Neon Rush simulation", () => {
  it("increases crystal rewards through combos and resets on a missed crystal", () => {
    const run = emptyRun();
    for (let i = 0; i < 3; i++) { run.items = [{ lane: 1, z: .95, kind: "energy" }]; stepRun(run, .04, false); }
    expect(run.energy).toBe(3); expect(multiplierOf(run)).toBe(2); expect(run.bonus).toBe(200);
    run.items = [{ lane: 0, z: .95, kind: "energy" }]; stepRun(run, .04, false);
    expect(run.streak).toBe(0); expect(run.maxStreak).toBe(3); expect(multiplierOf(run)).toBe(1);
  });

  it("collides with the craft's actual position while changing lanes", () => {
    const run = emptyRun(); run.lane = 2;
    run.items = [{ lane: 1, z: .959, kind: "block" }];
    expect(stepRun(run, .04, false).crashed).toBe(true);
  });

  it("does not collide with obstacles already passed when changing lanes", () => {
    const run = emptyRun(); run.items = [{ lane: 0, z: .95, kind: "block" }];
    expect(stepRun(run, .04, false).crashed).toBe(false);
    run.lane = 0; run.visualLane = 0;
    expect(stepRun(run, .04, false).crashed).toBe(false);
    expect(run.nearMisses).toBe(1);
  });

  it("lets a shield absorb exactly one impact", () => {
    const run = emptyRun(); run.shield = 6;
    run.items = [{ lane: 1, z: .95, kind: "block" }];
    expect(stepRun(run, .04, false).crashed).toBe(false); expect(run.shield).toBe(0);
    run.items = [{ lane: 1, z: .95, kind: "block" }];
    expect(stepRun(run, .04, false).crashed).toBe(true);
  });

  it("awards each mission once and includes it in the final score", () => {
    const run = emptyRun(); run.energy = 8; run.distance = 1000; run.nearMisses = 4;
    expect(stepRun(run, .04, false).events.filter(e => e.kind === "mission")).toHaveLength(3);
    expect(run.bonus).toBe(900); expect(scoreOf(run)).toBe(Math.floor(run.distance) + 900);
    expect(stepRun(run, .04, false).events.filter(e => e.kind === "mission")).toHaveLength(0);
  });

  it("requires releasing boost after depletion before accelerating again", () => {
    const run = emptyRun(); run.boost = .1;
    expect(stepRun(run, .04, true).boosting).toBe(true); expect(run.boostLocked).toBe(true);
    for (let i = 0; i < 20; i++) expect(stepRun(run, .04, true).boosting).toBe(false);
    stepRun(run, .04, false);
    expect(stepRun(run, .04, true).boosting).toBe(true);
  });

  it("keeps an open lane in advanced obstacle waves", () => {
    const run = emptyRun(); run.distance = 1500; run.spawn = 0;
    stepRun(run, .04, false, () => .2);
    const blocks = run.items.filter(item => item.kind === "block");
    expect(blocks).toHaveLength(2); expect(new Set(blocks.map(item => item.lane)).size).toBe(2);
    const pickup = run.items.find(item => item.kind !== "block")!;
    expect(blocks.some(item => item.lane === pickup.lane)).toBe(false);
  });

  it("starts each difficulty at its own speed and resets all progress", () => {
    expect(snapshot(createRun("cruise")).speed).toBe(145);
    expect(snapshot(createRun("overdrive")).speed).toBe(230);
    expect(snapshot(createRun()).missions).toEqual([false, false, false]);
  });
});
