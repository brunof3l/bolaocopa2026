"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { guesses, matches, users } from "@/db/schema";
import { calculatePredictionReward } from "@/lib/tournamentEngine";
import type { MatchResult, Prediction } from "@/types/bolao";

type SaveGuessInput = {
  userId: string;
  matchId: string;
  guessA: number;
  guessB: number;
  bypassWindow?: boolean;
};

type UpdateOfficialResultInput = {
  matchId: string;
  scoreA: number | null;
  scoreB: number | null;
  status: "SCHEDULED" | "FINISHED";
};

const db = getDb();

function normalizeScore(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Placar invalido.");
  }

  return Math.trunc(value);
}

function canEditGuess(matchDate: Date, bypassWindow = false) {
  const now = Date.now();
  const kickoff = matchDate.getTime();
  const opensAt = kickoff - 48 * 60 * 60 * 1000;

  if (now >= kickoff) {
    return false;
  }

  if (bypassWindow) {
    return true;
  }

  return now >= opensAt;
}

async function recalculateUserBalances(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userIds: string[],
) {
  if (!userIds.length) {
    return;
  }

  for (const userId of userIds) {
    const [aggregate] = await tx
      .select({
        total: sql<number>`coalesce(sum(${guesses.earnedBalance}), 0)`,
      })
      .from(guesses)
      .where(eq(guesses.userId, userId));

    await tx
      .update(users)
      .set({ totalBalance: Number(aggregate?.total ?? 0) })
      .where(eq(users.id, userId));
  }
}

export async function saveGuessAction(input: SaveGuessInput) {
  const guessA = normalizeScore(input.guessA);
  const guessB = normalizeScore(input.guessB);

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, input.matchId))
    .limit(1);

  if (!match) {
    throw new Error("Jogo nao encontrado.");
  }

  if (!canEditGuess(match.matchDate, input.bypassWindow)) {
    throw new Error("Janela de palpite fechada para este jogo.");
  }

  return db.transaction(async (tx) => {
    const [existingGuess] = await tx
      .select()
      .from(guesses)
      .where(
        and(eq(guesses.userId, input.userId), eq(guesses.matchId, input.matchId)),
      )
      .limit(1);

    const reward = calculatePredictionReward(
      {
        userId: input.userId,
        gameId: input.matchId,
        homeScore: guessA,
        awayScore: guessB,
        updatedAt: new Date().toISOString(),
      },
      {
        gameId: input.matchId,
        homeScore: match.scoreA,
        awayScore: match.scoreB,
        finished: match.status === "FINISHED",
      },
    );

    if (existingGuess) {
      await tx
        .update(guesses)
        .set({
          guessA,
          guessB,
          earnedBalance: reward.amount,
        })
        .where(eq(guesses.id, existingGuess.id));
    } else {
      await tx.insert(guesses).values({
        userId: input.userId,
        matchId: input.matchId,
        guessA,
        guessB,
        earnedBalance: reward.amount,
      });
    }

    await recalculateUserBalances(tx, [input.userId]);
    revalidatePath("/");

    return {
      ok: true,
      earnedBalance: reward.amount,
    };
  });
}

export async function updateOfficialResultAction(
  input: UpdateOfficialResultInput,
) {
  if (input.status === "FINISHED") {
    if (input.scoreA === null || input.scoreB === null) {
      throw new Error("Informe os dois placares para encerrar o jogo.");
    }
  }

  const scoreA = input.scoreA === null ? null : normalizeScore(input.scoreA);
  const scoreB = input.scoreB === null ? null : normalizeScore(input.scoreB);

  return db.transaction(async (tx) => {
    const [updatedMatch] = await tx
      .update(matches)
      .set({
        scoreA,
        scoreB,
        status: input.status,
      })
      .where(eq(matches.id, input.matchId))
      .returning();

    if (!updatedMatch) {
      throw new Error("Jogo nao encontrado para atualizacao.");
    }

    const matchGuesses = await tx
      .select()
      .from(guesses)
      .where(eq(guesses.matchId, input.matchId));

    const affectedUserIds = new Set<string>();

    for (const guess of matchGuesses) {
      const reward = calculatePredictionReward(
        {
          userId: guess.userId,
          gameId: guess.matchId,
          homeScore: guess.guessA,
          awayScore: guess.guessB,
          updatedAt: new Date().toISOString(),
        } satisfies Prediction,
        {
          gameId: updatedMatch.id,
          homeScore: updatedMatch.scoreA,
          awayScore: updatedMatch.scoreB,
          finished: updatedMatch.status === "FINISHED",
        } satisfies MatchResult,
      );

      await tx
        .update(guesses)
        .set({
          earnedBalance: reward.amount,
        })
        .where(eq(guesses.id, guess.id));

      affectedUserIds.add(guess.userId);
    }

    await recalculateUserBalances(tx, [...affectedUserIds]);
    revalidatePath("/");

    return {
      ok: true,
      affectedUsers: affectedUserIds.size,
    };
  });
}

export async function getFinancialLeaderboardAction() {
  return db
    .select({
      id: users.id,
      name: users.name,
      totalBalance: users.totalBalance,
    })
    .from(users)
    .orderBy(sql`${users.totalBalance} desc, ${users.name} asc`);
}

export async function getMatchWithGuessesAction(matchId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) {
    return null;
  }

  const matchGuesses = await db
    .select({
      id: guesses.id,
      userId: guesses.userId,
      matchId: guesses.matchId,
      guessA: guesses.guessA,
      guessB: guesses.guessB,
      earnedBalance: guesses.earnedBalance,
      userName: users.name,
    })
    .from(guesses)
    .innerJoin(users, eq(users.id, guesses.userId))
    .where(eq(guesses.matchId, matchId));

  return {
    match,
    guesses: matchGuesses,
  };
}

export async function syncAllUserBalancesAction() {
  return db.transaction(async (tx) => {
    const allUsers = await tx.select({ id: users.id }).from(users);
    await recalculateUserBalances(
      tx,
      allUsers.map((user) => user.id),
    );
    revalidatePath("/");

    return {
      ok: true,
      usersUpdated: allUsers.length,
    };
  });
}

export async function seedUsersIfMissingAction(
  names: string[],
) {
  const cleanNames = names.map((name) => name.trim()).filter(Boolean);

  return db.transaction(async (tx) => {
    const existing = await tx.select({ name: users.name }).from(users);
    const existingNames = new Set(existing.map((item) => item.name));
    const missing = cleanNames.filter((name) => !existingNames.has(name));

    if (missing.length) {
      await tx.insert(users).values(missing.map((name) => ({ name })));
    }

    revalidatePath("/");

    return {
      ok: true,
      inserted: missing.length,
    };
  });
}

export async function getUsersForGuessesAction(userIds: string[]) {
  if (!userIds.length) {
    return [];
  }

  return db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));
}
