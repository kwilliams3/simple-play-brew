import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NeonRush from "@/components/NeonRush";

let nextFrame: FrameRequestCallback;
let clock: number;
function advance(frames: number) {
  act(() => { for (let i = 0; i < frames; i++) { clock += 40; nextFrame(clock); } });
}
beforeEach(() => {
  clock = 0;
  localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({}, { get: (_, key) => key === "createLinearGradient" || key === "createRadialGradient" ? () => gradient : vi.fn(), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Neon Rush", () => {
  it("starts a run, freezes its score while paused, and resumes", () => {
    render(<NeonRush />);
    fireEvent.click(screen.getByRole("button", { name: /Lancer la course/ }));
    advance(20);
    const scoreBeforePause = document.querySelector(".in-game-score strong")!.textContent;
    expect(Number(scoreBeforePause)).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByRole("button", { name: /Reprendre la course/ })).toBeInTheDocument();
    const pausedScore = document.querySelector(".telemetry strong")!.textContent;
    advance(30);
    expect(document.querySelector(".telemetry strong")!.textContent).toBe(pausedScore);
    fireEvent.keyDown(window, { key: "Escape" });
    advance(5);
    expect(Number(document.querySelector(".in-game-score strong")!.textContent)).toBeGreaterThan(Number(scoreBeforePause));
  });

  it("ends a run on collision, persists the record, and resets on replay", () => {
    vi.spyOn(Math, "random").mockReturnValue(.4); // Put obstacles in the player's middle lane.
    render(<NeonRush />);
    fireEvent.keyDown(window, { key: "Enter" });
    advance(80);
    expect(screen.getByRole("button", { name: /Nouvelle tentative/ })).toBeInTheDocument();
    expect(Number(localStorage.getItem("neon-rush-best"))).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle tentative/ }));
    advance(4);
    expect(Number(document.querySelector(".in-game-score strong")!.textContent)).toBeLessThan(5);
  });

  it("pauses when the window loses focus", () => {
    render(<NeonRush />);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.blur(window);
    expect(screen.getByRole("button", { name: /Reprendre la course/ })).toBeInTheDocument();
  });
});
