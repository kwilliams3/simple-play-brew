import { useState, useEffect, useCallback } from "react";

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

const MemoryGame = () => {
  const [cards, setCards] = useState<Card[]>(createBoard);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [won, setWon] = useState(false);

  const handleClick = useCallback(
    (id: number) => {
      if (isChecking) return;
      const card = cards.find((c) => c.id === id);
      if (!card || card.isFlipped || card.isMatched) return;
      if (selected.length >= 2) return;

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
    [cards, selected, isChecking]
  );

  useEffect(() => {
    if (matches === EMOJIS.length) {
      setWon(true);
    }
  }, [matches]);

  const restart = () => {
    setCards(createBoard());
    setSelected([]);
    setMoves(0);
    setMatches(0);
    setIsChecking(false);
    setWon(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
        🧠 Memory
      </h1>

      <div className="flex gap-6 text-lg font-medium text-muted-foreground">
        <span>
          Coups : <span className="text-primary font-bold">{moves}</span>
        </span>
        <span>
          Paires : <span className="text-secondary font-bold">{matches}/{EMOJIS.length}</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className="perspective h-20 w-20 cursor-pointer sm:h-24 sm:w-24"
            onClick={() => handleClick(card.id)}
          >
            <div
              className={`card-flip relative h-full w-full ${
                card.isFlipped || card.isMatched ? "flipped" : ""
              }`}
            >
              {/* Front - hidden side */}
              <div className="card-face absolute inset-0 flex items-center justify-center rounded-lg bg-primary shadow-md text-3xl text-primary-foreground font-bold select-none">
                ?
              </div>
              {/* Back - emoji side */}
              <div
                className={`card-face card-back absolute inset-0 flex items-center justify-center rounded-lg bg-card shadow-md text-4xl select-none border-2 transition-colors duration-300 ${
                  card.isMatched
                    ? "border-secondary bg-secondary/10"
                    : "border-border"
                }`}
              >
                {card.emoji}
              </div>
            </div>
          </div>
        ))}
      </div>

      {won && (
        <div className="animate-bounce-in flex flex-col items-center gap-3 rounded-xl bg-card p-6 shadow-lg border border-border">
          <span className="text-4xl animate-celebrate">🎉</span>
          <p className="text-xl font-bold text-foreground">
            Bravo ! En {moves} coups !
          </p>
          <button
            onClick={restart}
            className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground shadow hover:opacity-90 transition-opacity"
          >
            Rejouer
          </button>
        </div>
      )}

      {!won && (
        <button
          onClick={restart}
          className="rounded-lg bg-muted px-5 py-2 font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Recommencer
        </button>
      )}
    </div>
  );
};

export default MemoryGame;
