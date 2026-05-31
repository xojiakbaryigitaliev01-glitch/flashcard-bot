import { useState, useEffect, useCallback } from "react";
import { useGetCards, useSaveCards } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCardsQueryKey } from "@workspace/api-client-react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        expand: () => void;
        initDataUnsafe?: { user?: { id?: number } };
      };
    };
  }
}

interface Card {
  id: number;
  front: string;
  back: string;
}

type Mode = "manage" | "study" | "results";

const MAX_CARDS = 50;

function getTelegramUserId(): string {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.expand();
    const id = tg.initDataUnsafe?.user?.id;
    if (id) return String(id);
  }
  return "default";
}

export default function FlashcardApp() {
  const userId = getTelegramUserId();
  const queryClient = useQueryClient();

  const { data: serverCards, isLoading } = useGetCards(userId);
  const saveCardsMutation = useSaveCards();

  const [cards, setCards] = useState<Card[]>(() =>
    Array.from({ length: MAX_CARDS }, (_, i) => ({ id: i, front: "", back: "" }))
  );
  const [mode, setMode] = useState<Mode>("manage");
  const [frontInput, setFrontInput] = useState("");
  const [backInput, setBackInput] = useState("");

  // Study state
  const [studyCards, setStudyCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [totalShown, setTotalShown] = useState(0);
  const [answerPending, setAnswerPending] = useState(false);

  useEffect(() => {
    if (serverCards && Array.isArray(serverCards)) {
      const merged = Array.from({ length: MAX_CARDS }, (_, i) => ({ id: i, front: "", back: "" }));
      serverCards.forEach((sc: Card) => {
        if (sc.id >= 0 && sc.id < MAX_CARDS) {
          merged[sc.id] = sc;
        }
      });
      setCards(merged);
    }
  }, [serverCards]);

  const persistCards = useCallback((updatedCards: Card[]) => {
    saveCardsMutation.mutate(
      { userId, data: { cards: updatedCards } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCardsQueryKey(userId) });
        },
      }
    );
  }, [saveCardsMutation, userId, queryClient]);

  const filledCards = cards.filter(c => c.front.trim() && c.back.trim());
  const filledCount = filledCards.length;
  const emptyCount = MAX_CARDS - filledCount;

  function addCard() {
    const f = frontInput.trim();
    const b = backInput.trim();
    if (!f || !b) return;
    const emptySlot = cards.find(c => !c.front.trim() && !c.back.trim());
    if (!emptySlot) return;
    const updated = cards.map(c => c.id === emptySlot.id ? { ...c, front: f, back: b } : c);
    setCards(updated);
    persistCards(updated);
    setFrontInput("");
    setBackInput("");
  }

  function deleteCard(id: number) {
    const updated = cards.map(c => c.id === id ? { ...c, front: "", back: "" } : c);
    setCards(updated);
    persistCards(updated);
  }

  function startStudy() {
    if (filledCards.length === 0) return;
    const shuffled = [...filledCards].sort(() => Math.random() - 0.5);
    setStudyCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setAnswers({});
    setTotalShown(0);
    setMode("study");
  }

  function handleAnswer(isCorrect: boolean) {
    if (answerPending) return;
    setAnswerPending(true);
    const card = studyCards[currentIndex];
    const newAnswers = { ...answers, [card.id]: isCorrect };
    setAnswers(newAnswers);
    const newTotal = totalShown + 1;
    setTotalShown(newTotal);

    setTimeout(() => {
      if (currentIndex < studyCards.length - 1) {
        setCurrentIndex(i => i + 1);
        setIsFlipped(false);
      } else {
        setMode("results");
      }
      setAnswerPending(false);
    }, 400);
  }

  // Results calc
  const correctCount = Object.values(answers).filter(v => v).length;
  const incorrectCount = totalShown - correctCount;
  const percentage = totalShown > 0 ? Math.round((correctCount / totalShown) * 100) : 0;

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Yuklanmoqda...</div>
      </div>
    );
  }

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.title}>📚 Flashcard</div>
          <div style={styles.subtitle}>Memorizing words is easy!</div>
        </div>

        {/* MANAGE MODE */}
        {mode === "manage" && (
          <div>
            <div style={styles.stats}>
              <div style={styles.statBox}>
                <span style={styles.statNumber}>{filledCount}</span>
                <span style={styles.statLabel}>Filled</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statNumber}>{emptyCount}</span>
                <span style={styles.statLabel}>Empty</span>
              </div>
            </div>

            <div style={styles.addCardSection}>
              <h2 style={styles.sectionTitle}>Add a New Card</h2>
              <input
                type="text"
                placeholder="So'z yoki ibora"
                value={frontInput}
                onChange={e => setFrontInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && document.getElementById("backInput")?.focus()}
                style={styles.input}
              />
              <input
                id="backInput"
                type="text"
                placeholder="Tarjima yoki ta'rif"
                value={backInput}
                onChange={e => setBackInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCard()}
                style={styles.input}
              />
              <button
                onClick={addCard}
                disabled={!frontInput.trim() || !backInput.trim()}
                style={{ ...styles.button, ...styles.addButton }}
              >
                ➕ Add
              </button>
            </div>

            <div style={styles.cardsGrid}>
              {cards.map((card, idx) => (
                <div
                  key={card.id}
                  style={{
                    ...styles.cardItem,
                    borderColor: card.front.trim() ? "#667eea" : "rgba(255,255,255,0.1)",
                    opacity: card.front.trim() ? 1 : 0.5,
                  }}
                >
                  <div style={styles.cardNumber}>#{idx + 1}</div>
                  {card.front.trim() && (
                    <>
                      <div style={styles.cardPreview}>{card.front.substring(0, 15)}</div>
                      <div style={styles.cardPreview}>{card.back.substring(0, 15)}</div>
                      <button
                        onClick={() => deleteCard(card.id)}
                        style={styles.deleteBtn}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={startStudy}
              disabled={filledCount === 0}
              style={{ ...styles.button, ...styles.startButton, opacity: filledCount === 0 ? 0.5 : 1 }}
            >
              ▶️ Start Learning
            </button>
          </div>
        )}

        {/* STUDY MODE */}
        {mode === "study" && studyCards.length > 0 && (
          <div>
            <div style={styles.studyHeader}>
              <div style={styles.progressCounter}>
                {currentIndex + 1} / {studyCards.length}
              </div>
              <button onClick={() => setMode("manage")} style={styles.exitBtn}>✕</button>
            </div>

            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${((currentIndex + 1) / studyCards.length) * 100}%`,
                }}
              />
            </div>

            <div style={styles.flashcardContainer} onClick={() => setIsFlipped(f => !f)}>
              <div style={{ ...styles.flashcard, transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                <div style={styles.flashcardFront}>
                  <div style={styles.flashcardContent}>{studyCards[currentIndex]?.front}</div>
                  <div style={styles.flipHint}>👆 Rotate</div>
                </div>
                <div style={styles.flashcardBack}>
                  <div style={styles.flashcardContent}>{studyCards[currentIndex]?.back}</div>
                  <div style={styles.flipHint}>🔙 Rotate</div>
                </div>
              </div>
            </div>

            <div style={styles.answerButtons}>
              <button
                onClick={() => handleAnswer(false)}
                disabled={answerPending}
                style={{ ...styles.answerButton, ...styles.incorrectButton }}
              >
                ✗ Incorrect
              </button>
              <button
                onClick={() => handleAnswer(true)}
                disabled={answerPending}
                style={{ ...styles.answerButton, ...styles.correctButton }}
              >
                ✓ Correct
              </button>
            </div>
          </div>
        )}

        {/* RESULTS MODE */}
        {mode === "results" && (
          <div style={styles.resultsContainer}>
            <h2 style={styles.resultsTitle}>Results 🎯</h2>

            <div style={styles.scoreCircle}>
              <span style={{
                ...styles.scorePercentage,
                color: percentage >= 90 ? "#10b981" : "#ef4444",
                WebkitTextFillColor: percentage >= 90 ? "#10b981" : "#ef4444",
              }}>
                {percentage}%
              </span>
            </div>

            <div style={styles.resultStats}>
              <div style={styles.resultBox}>
                <span style={{ ...styles.resultNumber, color: "#10b981" }}>{correctCount}</span>
                <div style={styles.resultLabel}>Correct</div>
              </div>
              <div style={styles.resultBox}>
                <span style={{ ...styles.resultNumber, color: "#ef4444" }}>{incorrectCount}</span>
                <div style={styles.resultLabel}>Incorrect</div>
              </div>
            </div>

            {percentage < 90 ? (
              <div style={styles.chichvordingBox}>
                <p style={styles.chichvordingText}>🚫 Damn low score</p>
                <p style={styles.chichvordingSubtext}>Hit above 90%!</p>
              </div>
            ) : (
              <div style={styles.celebrationBox}>
                <p style={styles.celebrationText}>🎉 Perfect!</p>
                <p style={styles.celebrationSubtext}>You nailed it!</p>
              </div>
            )}

            <button onClick={startStudy} style={{ ...styles.button, ...styles.restartButton }}>
              Review 🔄
            </button>
            <button onClick={() => setMode("manage")} style={{ ...styles.button, ...styles.backButton }}>
              ← Back
            </button>
          </div>
        )}

        <div style={styles.footer}>Made with Xojiakbar and Alimova for learning</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
    color: "#ffffff",
    padding: "10px",
    minHeight: "100vh",
    overflowX: "hidden",
  },
  container: {
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
  },
  loadingText: {
    color: "#fff",
    fontSize: "18px",
  },
  header: {
    textAlign: "center",
    marginBottom: "20px",
    padding: "15px 0",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "5px",
  },
  subtitle: {
    fontSize: "13px",
    opacity: 0.7,
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "20px",
  },
  statBox: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "15px",
    borderRadius: "10px",
    textAlign: "center",
    boxShadow: "0 4px 15px rgba(102,126,234,0.2)",
    display: "flex",
    flexDirection: "column",
  },
  statNumber: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "5px",
    display: "block",
  },
  statLabel: {
    fontSize: "12px",
    opacity: 0.9,
  },
  addCardSection: {
    background: "rgba(255,255,255,0.05)",
    padding: "15px",
    borderRadius: "10px",
    marginBottom: "20px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    marginBottom: "12px",
    marginTop: 0,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    marginBottom: "10px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
  },
  button: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.3s ease",
  },
  addButton: {
    width: "100%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
  },
  startButton: {
    width: "100%",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "white",
    fontSize: "16px",
    padding: "14px",
    marginTop: "20px",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
    gap: "8px",
    marginBottom: "20px",
  },
  cardItem: {
    background: "rgba(255,255,255,0.05)",
    padding: "10px",
    borderRadius: "8px",
    border: "2px solid",
    minHeight: "90px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    fontSize: "11px",
  },
  cardNumber: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.5)",
    fontWeight: "bold",
    marginBottom: "5px",
  },
  cardPreview: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.9)",
    marginBottom: "3px",
    lineHeight: 1.2,
    wordBreak: "break-word",
  },
  deleteBtn: {
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "3px 6px",
    fontSize: "11px",
    cursor: "pointer",
    marginTop: "4px",
  },
  studyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
  },
  progressCounter: {
    background: "rgba(255,255,255,0.1)",
    padding: "8px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  exitBtn: {
    width: "36px",
    height: "36px",
    padding: 0,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "50%",
    color: "white",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    width: "100%",
    height: "4px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "2px",
    marginBottom: "20px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
    transition: "width 0.3s ease",
  },
  flashcardContainer: {
    width: "100%",
    height: "250px",
    marginBottom: "20px",
    perspective: "1000px",
    cursor: "pointer",
  },
  flashcard: {
    width: "100%",
    height: "100%",
    position: "relative",
    transformStyle: "preserve-3d",
    transition: "transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  },
  flashcardFront: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box",
    backfaceVisibility: "hidden",
    textAlign: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
  },
  flashcardBack: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box",
    backfaceVisibility: "hidden",
    textAlign: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
    transform: "rotateY(180deg)",
  },
  flashcardContent: {
    fontSize: "26px",
    fontWeight: "bold",
    marginBottom: "10px",
    wordWrap: "break-word",
    wordBreak: "break-word",
    maxHeight: "100px",
    overflow: "hidden",
  },
  flipHint: {
    fontSize: "12px",
    opacity: 0.8,
  },
  answerButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "20px",
  },
  answerButton: {
    padding: "12px",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "transparent",
  },
  incorrectButton: {
    color: "#ef4444",
    border: "2px solid #ef4444",
  },
  correctButton: {
    color: "#10b981",
    border: "2px solid #10b981",
  },
  resultsContainer: {
    background: "rgba(255,255,255,0.05)",
    padding: "20px",
    borderRadius: "12px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  resultsTitle: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "20px",
    marginTop: 0,
  },
  scoreCircle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
    marginTop: "20px",
  },
  scorePercentage: {
    fontSize: "64px",
    fontWeight: "bold",
  },
  resultStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "20px",
  },
  resultBox: {
    background: "rgba(255,255,255,0.05)",
    padding: "15px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  resultNumber: {
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "5px",
    display: "block",
  },
  resultLabel: {
    fontSize: "12px",
    opacity: 0.7,
  },
  chichvordingBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid #ef4444",
    borderRadius: "10px",
    padding: "15px",
    marginBottom: "15px",
  },
  chichvordingText: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#ef4444",
    margin: "0 0 5px 0",
  },
  chichvordingSubtext: {
    fontSize: "12px",
    color: "rgba(239,68,68,0.8)",
    margin: 0,
  },
  celebrationBox: {
    background: "rgba(16,185,129,0.1)",
    border: "1px solid #10b981",
    borderRadius: "10px",
    padding: "15px",
    marginBottom: "15px",
  },
  celebrationText: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#10b981",
    margin: "0 0 5px 0",
  },
  celebrationSubtext: {
    fontSize: "12px",
    color: "rgba(16,185,129,0.8)",
    margin: 0,
  },
  restartButton: {
    width: "100%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    marginBottom: "10px",
  },
  backButton: {
    width: "100%",
    background: "rgba(255,255,255,0.1)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  footer: {
    textAlign: "center",
    fontSize: "12px",
    opacity: 0.5,
    marginTop: "20px",
    paddingBottom: "10px",
  },
};
