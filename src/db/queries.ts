import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import { officialResults, users } from "@/db/schema";

export async function getAllUserNamesForApp() {
  try {
    const db = getDb();
    const rows = await db
      .select({ name: users.name })
      .from(users)
      .orderBy(asc(users.name));

    return rows.map((row) => row.name);
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
