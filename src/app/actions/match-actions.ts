"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  appGuesses,
  appSpecialPicks,
  guesses,
  matches,
  officialResults,
  users,
} from "@/db/schema";
import {
  getPredictionHits,
  roundDownCurrency,
  sharedPotContribution,
} from "@/lib/tournamentEngine";
import type { AppUserRole, SpecialPick } from "@/types/bolao";

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

type SaveOfficialAppResultInput = {
  gameId: string;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
};

type SaveAppGuessInput = {
  userId: string;
  gameId: string;
  homeScore: number | null;
  awayScore: number | null;
};

type SaveAppSpecialPickInput = {
  userId: string;
  champion: string;
  topScorer: string;
};

type UpdateUserRoleInput = {
  name: string;
  role: AppUserRole;
};

type VerifyPrivilegedAccessInput = {
  role: "admin" | "moderator";
  password: string;
};

const db = getDb();
const guessCloseWindowMs = 60 * 1000;
const DEFAULT_ADMIN_ACCESS_PASSWORD = "Bruno@2026";
const DEFAULT_MODERATOR_ACCESS_PASSWORD = "Moderador@2026";

function normalizeScore(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Placar invalido.");
  }

  return Math.trunc(value);
}

function canEditGuess(matchDate: Date, bypassWindow = false) {
  const now = Date.now();
  const kickoff = matchDate.getTime();
  const closesAt = kickoff - guessCloseWindowMs;

  if (now >= kickoff) {
    return false;
  }

  if (bypassWindow) {
    return true;
  }

  return now < closesAt;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function getPrivilegedAccessPassword(role: "admin" | "moderator") {
  if (role === "admin") {
    return process.env.ADMIN_ACCESS_PASSWORD?.trim() || DEFAULT_ADMIN_ACCESS_PASSWORD;
  }

  return (
    process.env.MODERATOR_ACCESS_PASSWORD?.trim() || DEFAULT_MODERATOR_ACCESS_PASSWORD
  );
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function recalculateAllFinancials(tx: Transaction) {
  const allUsers = await tx.select({ id: users.id }).from(users);
  const allMatches = await tx.select().from(matches).orderBy(asc(matches.matchDate));
  const allGuesses = await tx.select().from(guesses);
  const guessesByMatchId = new Map<string, typeof allGuesses>();
  const winningsByUser = new Map<string, number>();
  const participantCount = allUsers.length;

  for (const user of allUsers) {
    winningsByUser.set(user.id, 0);
  }

  for (const guess of allGuesses) {
    const matchGuesses = guessesByMatchId.get(guess.matchId) ?? [];
    matchGuesses.push(guess);
    guessesByMatchId.set(guess.matchId, matchGuesses);
  }

  let rolloverResult = 0;
  let rolloverGoals = 0;
  let rolloverExact = 0;

  for (const match of allMatches) {
    await tx
      .update(matches)
      .set({
        rolloverResult: roundCurrency(rolloverResult),
        rolloverGoals: roundCurrency(rolloverGoals),
        rolloverExact: roundCurrency(rolloverExact),
      })
      .where(eq(matches.id, match.id));

    const matchGuesses = guessesByMatchId.get(match.id) ?? [];
    const totalResultPot = roundCurrency(
      participantCount * sharedPotContribution.result + rolloverResult,
    );
    const totalGoalsPot = roundCurrency(
      participantCount * sharedPotContribution.goals + rolloverGoals,
    );
    const totalExactPot = roundCurrency(
      participantCount * sharedPotContribution.exact + rolloverExact,
    );
    const isSettled =
      match.status === "FINISHED" && match.scoreA !== null && match.scoreB !== null;

    if (!isSettled) {
      for (const guess of matchGuesses) {
        await tx
          .update(guesses)
          .set({ earnedBalance: 0 })
          .where(eq(guesses.id, guess.id));
      }
      continue;
    }

    const winners = {
      result: [] as string[],
      goals: [] as string[],
      exact: [] as string[],
    };

    for (const guess of matchGuesses) {
      const hits = getPredictionHits(
        {
          userId: guess.userId,
          gameId: guess.matchId,
          homeScore: guess.guessA,
          awayScore: guess.guessB,
          updatedAt: new Date().toISOString(),
        },
        {
          gameId: guess.matchId,
          homeScore: match.scoreA,
          awayScore: match.scoreB,
          finished: true,
        },
      );

      if (hits.resultHit) {
        winners.result.push(guess.userId);
      }

      if (hits.goalsHit) {
        winners.goals.push(guess.userId);
      }

      if (hits.exactHit) {
        winners.exact.push(guess.userId);
      }
    }

    const resultPayout = winners.result.length
      ? roundDownCurrency(totalResultPot / winners.result.length)
      : 0;
    const goalsPayout = winners.goals.length
      ? roundDownCurrency(totalGoalsPot / winners.goals.length)
      : 0;
    const exactPayout = winners.exact.length
      ? roundDownCurrency(totalExactPot / winners.exact.length)
      : 0;

    rolloverResult = winners.result.length
      ? roundCurrency(totalResultPot - resultPayout * winners.result.length)
      : totalResultPot;
    rolloverGoals = winners.goals.length
      ? roundCurrency(totalGoalsPot - goalsPayout * winners.goals.length)
      : totalGoalsPot;
    rolloverExact = winners.exact.length
      ? roundCurrency(totalExactPot - exactPayout * winners.exact.length)
      : totalExactPot;

    for (const guess of matchGuesses) {
      const hits = getPredictionHits(
        {
          userId: guess.userId,
          gameId: guess.matchId,
          homeScore: guess.guessA,
          awayScore: guess.guessB,
          updatedAt: new Date().toISOString(),
        },
        {
          gameId: guess.matchId,
          homeScore: match.scoreA,
          awayScore: match.scoreB,
          finished: true,
        },
      );
      const earnedBalance = roundCurrency(
        (hits.resultHit ? resultPayout : 0) +
          (hits.goalsHit ? goalsPayout : 0) +
          (hits.exactHit ? exactPayout : 0),
      );

      await tx
        .update(guesses)
        .set({ earnedBalance })
        .where(eq(guesses.id, guess.id));

      winningsByUser.set(
        guess.userId,
        roundCurrency((winningsByUser.get(guess.userId) ?? 0) + earnedBalance),
      );
    }
  }

  for (const user of allUsers) {
    await tx
      .update(users)
      .set({ totalBalance: roundCurrency(winningsByUser.get(user.id) ?? 0) })
      .where(eq(users.id, user.id));
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

    if (existingGuess) {
      await tx
        .update(guesses)
        .set({
          guessA,
          guessB,
          earnedBalance: 0,
        })
        .where(eq(guesses.id, existingGuess.id));
    } else {
      await tx.insert(guesses).values({
        userId: input.userId,
        matchId: input.matchId,
        guessA,
        guessB,
        earnedBalance: 0,
      });
    }

    await recalculateAllFinancials(tx);
    revalidatePath("/");

    return {
      ok: true,
      earnedBalance: 0,
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

    await recalculateAllFinancials(tx);
    revalidatePath("/");

    return {
      ok: true,
      affectedUsers: updatedMatch.id ? 1 : 0,
    };
  });
}

export async function saveOfficialAppResultAction(input: SaveOfficialAppResultInput) {
  const homeScore = input.homeScore === null ? null : normalizeScore(input.homeScore);
  const awayScore = input.awayScore === null ? null : normalizeScore(input.awayScore);

  if (input.finished && (homeScore === null || awayScore === null)) {
    throw new Error("Informe os dois placares para marcar o jogo como encerrado.");
  }

  await db
    .insert(officialResults)
    .values({
      gameId: input.gameId,
      homeScore,
      awayScore,
      finished: input.finished,
    })
    .onConflictDoUpdate({
      target: officialResults.gameId,
      set: {
        homeScore,
        awayScore,
        finished: input.finished,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/");

  return {
    ok: true,
    result: {
      gameId: input.gameId,
      homeScore,
      awayScore,
      finished: input.finished,
    },
  };
}

export async function saveAppGuessAction(input: SaveAppGuessInput) {
  if (input.homeScore === null || input.awayScore === null) {
    throw new Error("Informe os dois placares para salvar o palpite.");
  }

  const homeScore = normalizeScore(input.homeScore);
  const awayScore = normalizeScore(input.awayScore);

  await db
    .insert(appGuesses)
    .values({
      gameId: input.gameId,
      userId: input.userId,
      homeScore,
      awayScore,
    })
    .onConflictDoUpdate({
      target: [appGuesses.userId, appGuesses.gameId],
      set: {
        homeScore,
        awayScore,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/");

  return {
    ok: true,
    prediction: {
      userId: input.userId,
      gameId: input.gameId,
      homeScore,
      awayScore,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function saveAppSpecialPickAction(input: SaveAppSpecialPickInput) {
  const champion = input.champion.trim();
  const topScorer = input.topScorer.trim();

  await db
    .insert(appSpecialPicks)
    .values({
      userId: input.userId,
      champion,
      topScorer,
    })
    .onConflictDoUpdate({
      target: appSpecialPicks.userId,
      set: {
        champion,
        topScorer,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/");

  return {
    ok: true,
    specialPick: {
      userId: input.userId,
      champion,
      topScorer,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function syncAppSpecialPicksAction(picks: SpecialPick[]) {
  const sanitizedPicks = picks
    .map((pick) => ({
      userId: pick.userId.trim(),
      champion: pick.champion.trim(),
      topScorer: pick.topScorer.trim(),
    }))
    .filter(
      (pick) =>
        pick.userId &&
        (pick.champion.length > 0 || pick.topScorer.length > 0),
    );

  if (!sanitizedPicks.length) {
    return { ok: true, synced: 0 };
  }

  for (const pick of sanitizedPicks) {
    await db
      .insert(appSpecialPicks)
      .values(pick)
      .onConflictDoUpdate({
        target: appSpecialPicks.userId,
        set: {
          champion: pick.champion,
          topScorer: pick.topScorer,
          updatedAt: new Date(),
        },
      });
  }

  revalidatePath("/");

  return {
    ok: true,
    synced: sanitizedPicks.length,
  };
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
    await recalculateAllFinancials(tx);
    revalidatePath("/");

    return {
      ok: true,
      usersUpdated: true,
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

export async function updateUserRoleAction(input: UpdateUserRoleInput) {
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Usuario invalido.");
  }

  if (normalizedName.toLowerCase() === "bruno") {
    input.role = "admin";
  }

  const [updatedUser] = await db
    .update(users)
    .set({ role: input.role })
    .where(eq(users.name, normalizedName))
    .returning({
      id: users.id,
      name: users.name,
      role: users.role,
    });

  if (!updatedUser) {
    throw new Error("Usuario nao encontrado para atualizar o papel.");
  }

  revalidatePath("/");

  return {
    ok: true,
    user: updatedUser,
  };
}

export async function verifyPrivilegedAccessAction(
  input: VerifyPrivilegedAccessInput,
) {
  const password = input.password.trim();

  if (!password) {
    throw new Error("Informe a senha para acessar este perfil.");
  }

  const expectedPassword = getPrivilegedAccessPassword(input.role);

  if (password !== expectedPassword) {
    throw new Error("Senha incorreta para este perfil.");
  }

  return {
    ok: true,
  };
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
