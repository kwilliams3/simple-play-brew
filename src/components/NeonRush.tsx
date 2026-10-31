import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, CircleHelp, Crosshair, Flame, Maximize2, Pause, Play, RotateCcw, Shield, Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import { createRun, DIFFICULTIES, SECTORS, snapshot, scoreOf, stepRun, type Difficulty, type Item, type Run } from "@/lib/neon-engine";

type Mode = "ready" | "playing" | "paused" | "over";
const readBest = () => { try { const value = Number(localStorage.getItem("neon-rush-best")); return Number.isFinite(value) && value > 0 ? value : 0; } catch { return 0; } };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export default function NeonRush() {
  const canvas = useRef<HTMLCanvasElement>(null), arena = useRef<HTMLDivElement>(null);
  const run = useRef<Run>(createRun()), modeRef = useRef<Mode>("ready"), boostHeld = useRef(false);
  const touchStart = useRef<number | null>(null);
  const difficultyRef = useRef<Difficulty>("arcade");
  const sound = useRef<AudioContext | null>(null), mutedRef = useRef(false);
  const [mode, setMode] = useState<Mode>("ready");
  const [stats, setStats] = useState(() => snapshot(run.current));
  const [difficulty, setDifficulty] = useState<Difficulty>("arcade");
  const [notice, setNotice] = useState("");
  const [newRecord, setNewRecord] = useState(false);
  const [best, setBest] = useState(readBest), [muted, setMuted] = useState(false), [help, setHelp] = useState(false);
  const bestRef = useRef(best);
  const changeMode = useCallback((next: Mode) => {
    modeRef.current = next; setMode(next); boostHeld.current = false;
    setStats(snapshot(run.current));
  }, []);
  const beep = useCallback((frequency: number, duration = .09) => {
    if (mutedRef.current || !sound.current) return;
    const ctx = sound.current, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = "sine"; oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(.055, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }, []);
  const start = useCallback(() => {
    try { sound.current ??= new AudioContext(); void sound.current.resume().catch(() => {}); } catch { /* Audio is optional. */ }
    run.current = createRun(difficultyRef.current); setHelp(false); setNotice(""); setNewRecord(false); changeMode("playing");
  }, [changeMode]);
  const move = useCallback((direction: number) => {
    if (modeRef.current === "playing") run.current.lane = Math.max(0, Math.min(2, run.current.lane + direction));
  }, []);
  useEffect(() => () => { if (sound.current) { void sound.current.close().catch(() => {}); sound.current = null; } }, []);
  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      if (e.target instanceof Element && e.target.closest("button, a") && ["Enter", " "].includes(e.key)) return;
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (["ArrowLeft", "a", "A", "q", "Q"].includes(e.key)) move(-1);
      if (["ArrowRight", "d", "D"].includes(e.key)) move(1);
      if (e.code === "Space") boostHeld.current = modeRef.current === "playing";
      if (!e.repeat && ["p", "P", "Escape"].includes(e.key)) {
        if (modeRef.current === "playing") changeMode("paused");
        else if (modeRef.current === "paused") changeMode("playing");
      }
      if (!e.repeat && e.key === "Enter" && ["ready", "over"].includes(modeRef.current)) start();
    };
    const keyUp = (e: KeyboardEvent) => { if (e.code === "Space") boostHeld.current = false; };
    const blur = () => { if (modeRef.current === "playing") changeMode("paused"); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility); };
  }, [changeMode, move, start]);

  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let width = 900, height = 580, frame = 0, last = 0, uiElapsed = 0, time = 0;
    let noticeTime = 0;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const particles: { lane: number; x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
    let previousRun = run.current;
    const resize = () => {
      const rect = element.getBoundingClientRect(); width = rect.width; height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = width * dpr; element.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const polygon = (points: number[][], fill: string, stroke?: string) => {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    const draw = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, .04); last = now;
      const r = run.current, playing = modeRef.current === "playing";
      if (playing || (modeRef.current === "ready" && !reducedMotion)) time += dt;
      if (previousRun !== r) { particles.length = 0; noticeTime = 0; previousRun = r; }
      let boosting = false;
      if (playing) {
        const result = stepRun(r, dt, boostHeld.current); boosting = result.boosting;
        for (const event of result.events) {
          setNotice(event.text); noticeTime = 1.7;
          if (event.kind === "energy") beep(620 + Math.min(r.streak, 12) * 65);
          else if (event.kind === "crash") beep(75, .4);
          else if (event.kind === "near") beep(380, .05);
          else beep(event.kind === "impact" ? 200 : 1100, .18);
          if (!reducedMotion && ["energy", "shield", "impact", "crash"].includes(event.kind)) {
            const color = event.kind === "energy" ? "#79f4d4" : event.kind === "crash" ? "#ff5987" : "#a18aff";
            for (let i = 0; i < 18; i++) { const angle = i * Math.PI / 9; particles.push({ lane: event.lane, x: 0, y: 0, vx: Math.cos(angle) * (50 + i * 6), vy: Math.sin(angle) * (50 + i * 6), life: .65, color }); }
          }
        }
        if (result.crashed) {
          changeMode("over"); const score = scoreOf(r);
          setNewRecord(score > bestRef.current); bestRef.current = Math.max(bestRef.current, score); setBest(bestRef.current);
          try { localStorage.setItem("neon-rush-best", String(bestRef.current)); } catch { /* Storage is optional. */ }
        }
      }
      if (noticeTime > 0 && playing) { noticeTime -= dt; if (noticeTime <= 0) setNotice(""); }
      uiElapsed += dt;
      if (uiElapsed > .08 && playing) { uiElapsed = 0; setStats(snapshot(r, boosting)); }
      const theme = SECTORS[(Math.floor(r.distance / 650)) % SECTORS.length];
      const horizon = height * .33, center = width / 2;
      const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, "#07091b"); sky.addColorStop(.52, theme.sky); sky.addColorStop(1, "#080d1d"); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 65; i++) { const x = (Math.sin(i * 127.1) * .5 + .5) * width, y = (Math.cos(i * 37.3) * .5 + .5) * horizon; ctx.fillStyle = `rgba(190,205,255,${.2 + Math.sin(time + i) * .15})`; ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1); }
      const glow = ctx.createRadialGradient(center, horizon - 10, 0, center, horizon, width * .34); glow.addColorStop(0, "#8037b550"); glow.addColorStop(1, "#51208000"); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      ctx.save(); ctx.beginPath(); ctx.arc(center, horizon - 30, height * .12, 0, Math.PI * 2); ctx.clip();
      const sun = ctx.createLinearGradient(0, horizon - 100, 0, horizon + 30); sun.addColorStop(0, "#c78bea"); sun.addColorStop(1, "#8247c0"); ctx.fillStyle = sun; ctx.fillRect(center - 110, horizon - 140, 220, 200);
      ctx.fillStyle = "#111027"; for (let i = 0; i < 7; i++) ctx.fillRect(center - 110, horizon - 18 + i * 9, 220, 3 + i); ctx.restore();
      for (let i = 0; i < 30; i++) { const x = i * width / 29, h = 12 + ((i * 71) % 61); ctx.fillStyle = "#0a1022"; ctx.fillRect(x, horizon - h + 20, width / 38, h); ctx.fillStyle = "#7065a333"; ctx.fillRect(x + 4, horizon - h + 26, 2, h * .5); }
      polygon([[0, horizon + 30], [width * .19, horizon - 23], [width * .32, horizon + 30], [center, horizon], [width * .7, horizon + 23], [width * .88, horizon - 30], [width, horizon + 30], [width, height], [0, height]], "#090d1c");
      const project = (lane: number, z: number) => { const p = z * z; return { x: center + (lane - 1) * (width * .025 + p * width * .235), y: horizon + p * height * .61, scale: .08 + p }; };
      const roadHalf = (z: number) => width * (.045 + z * z * .41);
      polygon([[center - roadHalf(0), horizon], [center + roadHalf(0), horizon], [center + roadHalf(1.2), height * 1.21], [center - roadHalf(1.2), height * 1.21]], "#10142a");
      ctx.lineWidth = 1;
      const travel = modeRef.current === "ready" ? time * .25 : r.distance / 40;
      for (let i = 0; i < 22; i++) {
        const z = ((i / 22 + travel * .13) % 1.1), y = horizon + z * z * height * .61;
        ctx.strokeStyle = `rgba(109,95,187,${.09 + z * .3})`; ctx.beginPath(); ctx.moveTo(center - roadHalf(z), y); ctx.lineTo(center + roadHalf(z), y); ctx.stroke();
      }
      for (const lane of [-.5, .5, 1.5, 2.5]) {
        const a = project(lane, 0), b = project(lane, 1.3);
        ctx.strokeStyle = lane === -.5 || lane === 2.5 ? theme.color : "#5d4e8855"; ctx.lineWidth = lane === -.5 || lane === 2.5 ? 2 : 1;
        ctx.shadowBlur = 14; ctx.shadowColor = "#8f60ff"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.shadowBlur = 0;
      }
      for (let i = 0; i < 9; i++) {
        const z = ((i / 9 + travel * .09) % 1.15), p = z * z;
        for (const side of [-1, 1]) { const x = center + side * (roadHalf(z) + 12 + p * 45), y = horizon + p * height * .61; ctx.strokeStyle = `rgba(113,86,218,${.12 + p * .6})`; ctx.lineWidth = 2 + p * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12 - p * height * .48); ctx.stroke(); ctx.fillStyle = "#9d7cff"; ctx.fillRect(x - 2, y - 12 - p * height * .48, 4, 3); }
      }
      const items = modeRef.current === "ready" ? [{ lane: 0, z: .66, kind: "block" }, { lane: 2, z: .42, kind: "block" }, { lane: 1, z: .57, kind: "energy" }, { lane: 1, z: .39, kind: "energy" }, { lane: 2, z: .77, kind: "energy" }] as Item[] : r.items;
      for (const item of [...items].sort((a, b) => a.z - b.z)) {
        if (item.taken || item.z < 0) continue;
        const p = project(item.lane, item.z), s = p.scale * Math.min(width * .072, 65);
        if (item.kind === "block") {
          ctx.shadowBlur = 22; ctx.shadowColor = "#ff4c85";
          polygon([[p.x - s, p.y], [p.x + s, p.y], [p.x + s, p.y - s * 1.1], [p.x - s, p.y - s * 1.1]], "#351c3a", "#ff5987");
          polygon([[p.x - s, p.y - s * 1.1], [p.x - s * .7, p.y - s * 1.4], [p.x + s * .7, p.y - s * 1.4], [p.x + s, p.y - s * 1.1]], "#652846", "#ff7da3");
          ctx.shadowBlur = 0; ctx.strokeStyle = "#ff749b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - s * .35, p.y - s * .8); ctx.lineTo(p.x + s * .35, p.y - s * .3); ctx.moveTo(p.x + s * .35, p.y - s * .8); ctx.lineTo(p.x - s * .35, p.y - s * .3); ctx.stroke();
        } else {
          const y = p.y - s * .7 + Math.sin(time * 4 + item.z * 8) * 3, color = item.kind === "shield" ? "#7d9bff" : "#79f4d4";
          ctx.shadowColor = color; ctx.shadowBlur = 22;
          polygon([[p.x, y - s * .55], [p.x + s * .36, y], [p.x, y + s * .55], [p.x - s * .36, y]], item.kind === "shield" ? "#343d80" : "#124f49", color);
          ctx.fillStyle = "#dcfff6"; ctx.fillRect(p.x - 1, y - s * .2, 2, s * .4); ctx.shadowBlur = 0;
        }
      }
      const player = project(r.visualLane, .97), ship = Math.min(49, width * .065), py = height * .87 + Math.sin(time * 4) * 2;
      ctx.save(); ctx.translate(player.x, py); ctx.rotate(reducedMotion ? 0 : (r.lane - r.visualLane) * .22); ctx.translate(-player.x, -py);
      ctx.shadowBlur = boosting ? 40 : 22; ctx.shadowColor = "#6beded";
      const flame = 18 + Math.sin(time * 35) * 7 + (boosting ? 40 : 0);
      polygon([[player.x - ship * .26, py], [player.x, py + flame], [player.x + ship * .26, py]], "#6bfffaaa");
      polygon([[player.x, py - ship * .9], [player.x + ship, py + ship * .33], [player.x + ship * .3, py + ship * .13], [player.x, py + ship * .38], [player.x - ship * .3, py + ship * .13], [player.x - ship, py + ship * .33]], "#9aa6cc", "#c6dfff");
      polygon([[player.x, py - ship * .62], [player.x + ship * .2, py - ship * .05], [player.x, py + ship * .1], [player.x - ship * .2, py - ship * .05]], "#5cf2ed", "#baffff"); ctx.shadowBlur = 0;
      ctx.restore();
      if (r.shield > 0) { ctx.strokeStyle = "#8da9ff"; ctx.lineWidth = 2; ctx.shadowColor = "#799cff"; ctx.shadowBlur = 20; ctx.beginPath(); ctx.ellipse(player.x, py - 10, ship * 1.4, ship * 1.15, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
      if (boosting && !reducedMotion) { ctx.strokeStyle = "#bda9ff55"; for (let i = 0; i < 25; i++) { const x = ((i * 151 + time * 700) % width); ctx.beginPath(); ctx.moveTo(x, height * .55); ctx.lineTo(x + (x - center) * .1, height * .75); ctx.stroke(); } }
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (modeRef.current !== "paused") { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; }
        if (particle.life <= 0) { particles.splice(i, 1); continue; }
        const origin = project(particle.lane, .96);
        ctx.globalAlpha = particle.life / .65; ctx.fillStyle = particle.color; ctx.shadowColor = particle.color; ctx.shadowBlur = 12;
        ctx.fillRect(origin.x + particle.x, height * .86 + particle.y, 3, 3);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (r.flash > 0) { ctx.fillStyle = `rgba(125,155,255,${r.flash})`; ctx.fillRect(0, 0, width, height); }
      const vignette = ctx.createRadialGradient(center, height * .55, width * .12, center, height * .55, width * .7); vignette.addColorStop(0, "#00000000"); vignette.addColorStop(1, "#040611aa"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [beep, changeMode]);

  const toggleMute = () => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); };
  const selectDifficulty = (next: Difficulty) => {
    difficultyRef.current = next; setDifficulty(next);
    if (modeRef.current === "ready") { run.current = createRun(next); setStats(snapshot(run.current)); }
  };
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void arena.current?.requestFullscreen?.().catch(() => {}); };
  return <div className="rush-app">
    <header className="site-header"><a className="wordmark" href="/" aria-label="Neon Rush, accueil"><span className="brand-icon"><Zap size={21} fill="currentColor" /></span>NEON<span className="wordmark-light">RUSH</span><span className="edition">ARCADE</span></a><div className="header-right"><span className="local-status"><i /> SYSTÈME EN LIGNE</span><span className="header-divider" /><button className="icon-button" onClick={toggleMute} aria-label={muted ? "Activer le son" : "Couper le son"}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><span className="avatar">P1</span></div></header>
    <main className="rush-main">
      <div className="page-heading"><div><div className="eyebrow"><span /> L’ARCADE, À PLEINE VITESSE</div><h1>La nuit vous appartient<span>.</span></h1><p>Gardez le cap. Repoussez vos limites. Battez votre record.</p></div><div className="personal-best"><Trophy size={21} /><div><span>VOTRE RECORD</span><strong>{best.toLocaleString("fr-FR")} <small>PTS</small></strong></div></div></div>
      <div className="game-layout"><section className="game-column" aria-label="Neon Rush, jeu de course">
        <div className={`arena ${mode === "playing" && stats.speed >= 300 ? "is-boosting" : ""}`} ref={arena}
          onPointerDown={e => { if (e.target !== canvas.current || modeRef.current !== "playing") return; touchStart.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerUp={e => { if (touchStart.current === null) return; const delta = e.clientX - touchStart.current; if (Math.abs(delta) > 24) move(delta > 0 ? 1 : -1); touchStart.current = null; }}
          onPointerCancel={() => { touchStart.current = null; }}>
          <canvas ref={canvas} aria-label="Circuit néon à trois voies. Évitez les obstacles roses et collectez les cristaux verts." />
          <div className="game-top"><div className="sector"><span className="live-dot" /> SECTEUR {String(stats.level).padStart(2, "0")} <span className="sector-name">/ {SECTORS[(stats.level - 1) % SECTORS.length].name}</span></div><div className="arena-tools"><button className="arena-button" aria-label={mode === "paused" ? "Reprendre" : "Mettre en pause"} disabled={mode === "ready" || mode === "over"} onClick={e => { e.currentTarget.blur(); changeMode(mode === "playing" ? "paused" : "playing"); }}>{mode === "paused" ? <Play size={17} /> : <Pause size={17} />}</button><button className="arena-button" aria-label="Plein écran" onClick={fullscreen}><Maximize2 size={17} /></button></div></div>
          {mode === "playing" && <div className="in-game-score"><span>SCORE</span><strong>{String(stats.score).padStart(6, "0")}</strong>{stats.shield > 0 && <small><Shield size={13} /> Bouclier · {Math.ceil(stats.shield)} s</small>}</div>}
          {mode === "playing" && <><div className={`combo-badge ${stats.multiplier > 1 ? "combo-active" : ""}`}><span>MULTIPLICATEUR</span><strong>×{stats.multiplier}</strong><small>{stats.streak} cristaux à la suite</small></div><div className="run-notice" role="status" aria-live="polite">{notice}</div><div className="run-clock">{formatTime(stats.seconds)} <span>EN COURSE</span></div></>}
          {mode !== "playing" && <div className={`game-overlay ${mode === "ready" ? "intro-overlay" : ""}`}><div className="overlay-content"><span className={`game-label ${mode === "over" && newRecord ? "record-label" : ""}`}>{mode === "over" ? newRecord ? "★ NOUVEAU RECORD PERSONNEL" : "TRANSMISSION INTERROMPUE" : mode === "paused" ? "PRENEZ UNE RESPIRATION" : "ENDLESS NIGHT RUNNER · VOL. 02"}</span><h2>{mode === "over" ? <>FIN DE<span>COURSE</span></> : mode === "paused" ? <>EN<span>PAUSE</span></> : <>NEON<span>RUSH</span></>}</h2><p>{mode === "over" ? `${stats.score.toLocaleString("fr-FR")} points · ${stats.energy} cristaux collectés` : mode === "paused" ? "La ville vous attend. Prêt à repartir ?" : "Une ville sans fin. Trouvez votre rythme. Entrez dans le flow."}</p>
          {mode === "over" && <div className="run-results"><div><strong>{formatTime(stats.seconds)}</strong><span>TEMPS</span></div><div><strong>{stats.maxStreak}</strong><span>MEILLEURE SÉRIE</span></div><div><strong>{stats.missions.filter(Boolean).length}/3</strong><span>MISSIONS</span></div></div>}
          {(mode === "ready" || mode === "over") && <div className="difficulty-picker" role="group" aria-label="Difficulté">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(key => <button key={key} aria-pressed={difficulty === key} onClick={e => { selectDifficulty(key); e.currentTarget.blur(); }}>{DIFFICULTIES[key].label}</button>)}</div>}
          {mode === "ready" && <span className="difficulty-description">{DIFFICULTIES[difficulty].description}</span>}
          <button className="start-button" onClick={e => { e.currentTarget.blur(); if (mode === "paused") changeMode("playing"); else start(); }}>{mode === "over" ? <RotateCcw size={18} /> : <Play size={18} fill="currentColor" />}{mode === "over" ? "Nouvelle tentative" : mode === "paused" ? "Reprendre la course" : "Lancer la course"}<ArrowUpRight size={19} /></button><span className="enter-hint">{mode === "ready" || mode === "over" ? "ou appuyez sur ENTRÉE" : "ÉCHAP pour reprendre"}</span></div></div>}
          <div className="game-bottom"><span><i /> {mode === "playing" ? "COURSE EN COURS" : mode === "over" ? "SIGNAL PERDU" : "PRÊT AU DÉCOLLAGE"}</span><span>35° 40′ N · 139° 42′ E</span></div>
        </div>
        <div className="telemetry"><div><span className="stat-label"><Crosshair size={14} /> SCORE</span><strong>{String(stats.score).padStart(6, "0")}<small>PTS</small></strong></div><div><span className="stat-label"><Zap size={14} /> CRISTAUX</span><strong>{String(stats.energy).padStart(2, "0")}<small className="mint">+{50 * stats.multiplier} PTS</small></strong></div><div><span className="stat-label"><AudioLines size={14} /> VITESSE</span><strong>{stats.speed}<small>KM/H</small></strong></div><div className="boost-stat"><span className="stat-label"><Flame size={14} /> RÉSERVE BOOST <b>{Math.round(stats.boost)}%</b></span><div className="boost-track" role="progressbar" aria-label="Réserve de boost" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.boost)}><span style={{ width: `${stats.boost}%` }} /></div><small>{stats.boostLocked ? "Relâchez pour recharger" : "Maintenez ESPACE"}</small></div></div>
        <div className="mobile-controls"><button aria-label="Aller à gauche" disabled={mode !== "playing"} onClick={e => { move(-1); e.currentTarget.blur(); }}><ArrowLeft /></button><button className="mobile-boost" disabled={mode !== "playing"} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); boostHeld.current = true; }} onPointerUp={() => { boostHeld.current = false; }} onPointerCancel={() => { boostHeld.current = false; }} onLostPointerCapture={() => { boostHeld.current = false; }}><Zap size={18} /> BOOST</button><button aria-label="Aller à droite" disabled={mode !== "playing"} onClick={e => { move(1); e.currentTarget.blur(); }}><ArrowRight /></button></div>
        <div className="under-game"><span><span className="tiny-dot" /> Pas de téléchargement. Juste des réflexes.</span><button onClick={() => { if (modeRef.current === "playing") changeMode("paused"); setHelp(!help); }}><CircleHelp size={15} /> {help ? "Masquer l’aide" : "Comment jouer"}</button></div>
        <div className="missions-heading"><span>OBJECTIFS DE COURSE</span><small>3 DÉFIS · +300 PTS CHACUN</small></div>
        <div className="mission-grid">{[{ title: "Chasseur d’énergie", goal: 8, unit: "cristaux", icon: <Zap size={16} /> }, { title: "Au bout de la nuit", goal: 1000, unit: "mètres", icon: <Flame size={16} /> }, { title: "Sur le fil", goal: 4, unit: "esquives", icon: <Crosshair size={16} /> }].map((mission, index) => <div key={mission.title} className={`mission-card ${stats.missions[index] ? "mission-complete" : ""}`}><span className="mission-icon">{stats.missions[index] ? "✓" : mission.icon}</span><div><strong>{mission.title}</strong><span>{stats.missions[index] ? "Terminée · +300 points" : `${stats.progress[index]} / ${mission.goal} ${mission.unit}`}</span><div className="mission-track" role="progressbar" aria-label={mission.title} aria-valuemin={0} aria-valuemax={mission.goal} aria-valuenow={stats.progress[index]}><i style={{ width: `${stats.progress[index] / mission.goal * 100}%` }} /></div></div></div>)}</div>
        {help && <div className="help-panel">Changez de voie avec ← → ou Q / D, ou balayez le circuit sur mobile. Évitez les blocs roses. Enchaînez les cristaux sans en manquer : tous les 3 cristaux, votre multiplicateur augmente, jusqu’à ×4. Chaque cristal vaut 50 à 200 points. Passez près d’un obstacle pour gagner 25 points d’esquive. Les boucliers bleus absorbent un impact pendant 6 secondes. Maintenez Espace pour accélérer ; relâchez pour recharger. P ou Échap met le jeu en pause. Chaque mission accomplie rapporte 300 points.</div>}
      </section><aside className="sidebar"><div className="briefing panel"><span className="panel-kicker">LE BRIEFING <span>VOL. 02</span></span><div className="brief-icon"><Zap size={24} /></div><h3>Votre prochain record<br />commence ici.</h3><p>Faufilez-vous entre les obstacles et récoltez l’énergie de la ville. Plus vous survivez, plus tout s’accélère.</p><div className="objective"><span className="objective-symbol pink">×</span><div><strong>Esquivez les obstacles</strong><span>Un impact et la course s’arrête.</span></div></div><div className="objective"><span className="objective-symbol green">◇</span><div><strong>Collectez les cristaux</strong><span>De 50 à 200 points avec les combos.</span></div></div><div className="objective"><span className="objective-symbol blue"><Shield size={17} /></span><div><strong>Trouvez votre protection</strong><span>Un bouclier. Une seconde chance.</span></div></div></div>
      <div className="controls-panel panel"><span className="panel-kicker">AUX COMMANDES <Crosshair size={15} /></span><div className="control-row"><span>Changer de voie</span><div><kbd>←</kbd><kbd>→</kbd></div></div><div className="control-row"><span>Activer le boost</span><kbd className="wide-key">ESPACE</kbd></div><div className="control-row"><span>Faire une pause</span><kbd>P</kbd></div></div><div className="tip"><span>✧</span><p><strong>Le conseil du pilote</strong>Le boost rapporte plus de distance, mais vous laisse moins de temps pour réagir.</p></div></aside></div>
      <footer className="rush-footer"><span>CONÇU POUR LE FLOW<span className="footer-dot">·</span>JOUEZ POUR LE PLAISIR</span><span>UNE AUTRE COURSE ? TOUJOURS. <ArrowUpRight size={13} /></span></footer>
    </main>
  </div>;
}

