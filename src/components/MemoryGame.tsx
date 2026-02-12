import { useState, useEffect, useCallback, useRef } from "react";

const EMOJIS = ["🐶", "🐱", "🦊", "🐻", "🐼", "🦁", "🐸", "🐵"];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createBoard(): Card[] {
  const pairs = [...EMOJIS, ...EMOJIS];
  return shuffle(pairs).map((emoji, i) => ({
    id: i,
    emoji,
    isFlipped: false,
    isMatched: false,
  }));
}

const CONFETTI_COLORS = [
  "hsl(12, 80%, 62%)",
  "hsl(174, 50%, 45%)",
  "hsl(45, 90%, 60%)",
  "hsl(280, 60%, 60%)",
  "hsl(200, 70%, 55%)",
];

const Confetti = () => {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 6,
  }));

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: p.left,
            top: "-10px",
            animationDelay: p.delay,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}
    </>
  );
};

const MemoryGame = () => {
  const [cards, setCards] = useState<Card[]>(createBoard);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [won, setWon] = useState(false);
  const [lastMatch, setLastMatch] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && !won) {
      intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, won]);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const handleClick = useCallback(
    (id: number) => {
      if (isChecking) return;
      const card = cards.find((c) => c.id === id);
      if (!card || card.isFlipped || card.isMatched) return;
      if (selected.length >= 2) return;

      if (!isRunning) setIsRunning(true);

      const newCards = cards.map((c) =>
        c.id === id ? { ...c, isFlipped: true } : c
      );
      setCards(newCards);
      const newSelected = [...selected, id];
      setSelected(newSelected);

      if (newSelected.length === 2) {
        setMoves((m) => m + 1);
        setIsChecking(true);
        const [firstId, secondId] = newSelected;
        const first = newCards.find((c) => c.id === firstId)!;
        const second = newCards.find((c) => c.id === secondId)!;

        if (first.emoji === second.emoji) {
          setLastMatch(true);
          setTimeout(() => setLastMatch(false), 600);
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isMatched: true }
                  : c
              )
            );
            setMatches((m) => m + 1);
            setSelected([]);
            setIsChecking(false);
          }, 500);
        } else {
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isFlipped: false }
                  : c
              )
            );
            setSelected([]);
            setIsChecking(false);
          }, 800);
        }
      }
    },
    [cards, selected, isChecking, isRunning]
  );

  useEffect(() => {
    if (matches === EMOJIS.length) {
      setWon(true);
      setIsRunning(false);
    }
  }, [matches]);

  const restart = () => {
    setCards(createBoard());
    setSelected([]);
    setMoves(0);
    setMatches(0);
    setIsChecking(false);
    setWon(false);
    setTimer(0);
    setIsRunning(false);
    setLastMatch(false);
  };

  const stars = moves <= 10 ? 3 : moves <= 16 ? 2 : 1;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-4 relative overflow-hidden">
      {won && <Confetti />}

      {/* Title */}
      <div className="text-center">
        <h1 className="text-5xl font-bold text-foreground sm:text-6xl tracking-tight">
          🧠 Memory
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Retrouve toutes les paires !
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 rounded-2xl bg-card/80 backdrop-blur-sm px-6 py-3 shadow-md border border-border">
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Coups</span>
          <span className="text-2xl font-bold text-primary">{moves}</span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Paires</span>
          <span className="text-2xl font-bold text-secondary">{matches}/{EMOJIS.length}</span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Temps</span>
          <span className="text-2xl font-bold text-accent-foreground/70">{formatTime(timer)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-72 sm:w-80 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500 ease-out"
          style={{ width: `${(matches / EMOJIS.length) * 100}%` }}
        />
      </div>

      {/* Match flash */}
      {lastMatch && (
        <div className="absolute inset-0 pointer-events-none bg-secondary/5 animate-pulse rounded-3xl" />
      )}

      {/* Card grid */}
      <div className="grid grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card, index) => (
          <div
            key={card.id}
            className="perspective h-20 w-20 cursor-pointer sm:h-24 sm:w-24 card-hover"
            onClick={() => handleClick(card.id)}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div
              className={`card-flip relative h-full w-full ${
                card.isFlipped || card.isMatched ? "flipped" : ""
              }`}
            >
              {/* Front - hidden side */}
              <div className="card-face absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg text-3xl text-primary-foreground font-bold select-none shimmer">
                <span className="drop-shadow-sm">?</span>
              </div>
              {/* Back - emoji side */}
              <div
                className={`card-face card-back absolute inset-0 flex items-center justify-center rounded-2xl shadow-lg text-4xl select-none transition-all duration-300 ${
                  card.isMatched
                    ? "bg-secondary/10 border-2 border-secondary shadow-secondary/20 scale-95"
                    : "bg-card border-2 border-border"
                }`}
              >
                <span className={`transition-transform duration-300 ${card.isMatched ? "scale-110" : ""}`}>
                  {card.emoji}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Win overlay */}
      {won && (
        <div className="animate-bounce-in flex flex-col items-center gap-4 rounded-3xl bg-card/95 backdrop-blur-md p-8 shadow-2xl border border-border">
          <span className="text-5xl animate-celebrate">🎉</span>
          <p className="text-2xl font-bold text-foreground">
            Bravo !
          </p>
          <p className="text-muted-foreground font-medium">
            {moves} coups · {formatTime(timer)}
          </p>
          <div className="flex gap-1 text-2xl">
            {[1, 2, 3].map((s) => (
              <span key={s} className={s <= stars ? "opacity-100" : "opacity-20"}>⭐</span>
            ))}
          </div>
          <button
            onClick={restart}
            className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 px-8 py-3 font-bold text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            🔄 Rejouer
          </button>
        </div>
      )}

      {!won && (
        <button
          onClick={restart}
          className="rounded-xl bg-muted px-5 py-2.5 font-medium text-muted-foreground hover:bg-muted/70 hover:scale-105 transition-all duration-200"
        >
          🔄 Recommencer
        </button>
      )}
    </div>
  );
};

export default MemoryGame;
