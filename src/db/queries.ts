import { asc } from "drizzle-orm";

import { initialState } from "@/data/initialState";
import { getDb } from "@/db";
import { appGuesses, appSpecialPicks, officialResults, users } from "@/db/schema";
import type { AppUserRole, SpecialPick } from "@/types/bolao";

export async function ensureAppSeedData() {
  try {
    const db = getDb();

    if (initialState.predictions.length) {
      await db
        .insert(appGuesses)
        .values(
          initialState.predictions
            .filter(
              (prediction) =>
                prediction.homeScore !== null && prediction.awayScore !== null,
            )
            .map((prediction) => ({
              gameId: prediction.gameId,
              userId: prediction.userId,
              homeScore: prediction.homeScore as number,
              awayScore: prediction.awayScore as number,
            })),
        )
        .onConflictDoNothing();
    }

    if (initialState.specialPicks.length) {
      await db
        .insert(appSpecialPicks)
        .values(
          initialState.specialPicks.map((pick) => ({
            userId: pick.userId,
            champion: pick.champion,
            topScorer: pick.topScorer,
          })),
        )
        .onConflictDoNothing();
    }
  } catch {
    // Mantem o app carregando mesmo se o seed remoto falhar.
  }
}

export async function getAllUsersForApp() {
  try {
    const db = getDb();
    const rows = await db
      .select({ name: users.name, role: users.role })
      .from(users)
      .orderBy(asc(users.name));

    return rows.map((row) => ({
      name: row.name,
      role: row.name.trim().toLowerCase() === "bruno"
        ? ("admin" as AppUserRole)
        : row.role,
    }));
  } catch {
    return [];
  }
}

export async function getOfficialResultsForApp() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        gameId: officialResults.gameId,
        homeScore: officialResults.homeScore,
        awayScore: officialResults.awayScore,
        finished: officialResults.finished,
      })
      .from(officialResults)
      .orderBy(asc(officialResults.gameId));

    return rows;
  } catch {
    return [];
  }
}

export async function getAppPredictionsForApp() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        gameId: appGuesses.gameId,
        userId: appGuesses.userId,
        homeScore: appGuesses.homeScore,
        awayScore: appGuesses.awayScore,
        updatedAt: appGuesses.updatedAt,
      })
      .from(appGuesses)
      .orderBy(asc(appGuesses.gameId), asc(appGuesses.userId));

    return rows.map((row) => ({
      gameId: row.gameId,
      userId: row.userId,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      updatedAt: row.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getAppSpecialPicksForApp(): Promise<SpecialPick[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        userId: appSpecialPicks.userId,
        champion: appSpecialPicks.champion,
        topScorer: appSpecialPicks.topScorer,
        updatedAt: appSpecialPicks.updatedAt,
      })
      .from(appSpecialPicks)
      .orderBy(asc(appSpecialPicks.userId));

    return rows.map((row) => ({
      userId: row.userId,
      champion: row.champion,
      topScorer: row.topScorer,
      updatedAt: row.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
