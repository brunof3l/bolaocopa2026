import { gamesData } from "@/data/gamesData";
import type { AppState } from "@/types/bolao";

const now = "2026-06-11T10:00:00-03:00";

export const initialState: AppState = {
  predictions: [
    { userId: "bruno", gameId: "match-001", homeScore: 3, awayScore: 1, updatedAt: now },
    { userId: "edivaldo", gameId: "match-001", homeScore: 2, awayScore: 0, updatedAt: now },
    { userId: "eduardo", gameId: "match-001", homeScore: 3, awayScore: 0, updatedAt: now },
    {
      userId: "fernandinho",
      gameId: "match-001",
      homeScore: 2,
      awayScore: 1,
      updatedAt: now,
    },
    { userId: "gabriel", gameId: "match-001", homeScore: 2, awayScore: 0, updatedAt: now },
    { userId: "geovane", gameId: "match-001", homeScore: 3, awayScore: 0, updatedAt: now },
    { userId: "gustavo", gameId: "match-001", homeScore: 2, awayScore: 1, updatedAt: now },
    { userId: "sidnei", gameId: "match-001", homeScore: 2, awayScore: 0, updatedAt: now },
    { userId: "sidnei-jr", gameId: "match-001", homeScore: 1, awayScore: 1, updatedAt: now },

    { userId: "bruno", gameId: "match-002", homeScore: 0, awayScore: 0, updatedAt: now },
    { userId: "edivaldo", gameId: "match-002", homeScore: 0, awayScore: 1, updatedAt: now },
    { userId: "eduardo", gameId: "match-002", homeScore: 1, awayScore: 2, updatedAt: now },
    {
      userId: "fernandinho",
      gameId: "match-002",
      homeScore: 2,
      awayScore: 2,
      updatedAt: now,
    },
    { userId: "gabriel", gameId: "match-002", homeScore: 1, awayScore: 0, updatedAt: now },
    { userId: "geovane", gameId: "match-002", homeScore: 2, awayScore: 1, updatedAt: now },
    { userId: "gustavo", gameId: "match-002", homeScore: 2, awayScore: 0, updatedAt: now },
    { userId: "sidnei", gameId: "match-002", homeScore: 0, awayScore: 1, updatedAt: now },
    { userId: "sidnei-jr", gameId: "match-002", homeScore: 1, awayScore: 2, updatedAt: now },
  ],
  specialPicks: [
    { userId: "bruno", champion: "Portugal", topScorer: "Cristiano Ronaldo" },
    { userId: "edivaldo", champion: "Franca", topScorer: "Vinicius Junior" },
    { userId: "eduardo", champion: "Espanha", topScorer: "Cristiano Ronaldo" },
    { userId: "fernandinho", champion: "Portugal", topScorer: "K. Mbappe" },
    { userId: "gabriel", champion: "Brasil", topScorer: "Mbappe" },
    { userId: "geovane", champion: "Brasil", topScorer: "Endrick" },
    { userId: "gustavo", champion: "Espanha", topScorer: "Mbappe" },
    { userId: "sidnei", champion: "Brasil", topScorer: "Harry Kane" },
    { userId: "sidnei-jr", champion: "Inglaterra", topScorer: "Harry Kane" },
  ],
  results: gamesData.map((game) => ({
    gameId: game.id,
    homeScore: null,
    awayScore: null,
    finished: false,
  })),
  awards: {
    champion: null,
    topScorer: null,
  },
};
