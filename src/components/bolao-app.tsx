"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  Crown,
  GitBranch,
  Goal,
  Lock,
  LogIn,
  LogOut,
  Medal,
  Plus,
  RotateCcw,
  ShieldCheck,
  Swords,
  Table2,
  Trophy,
  Unlock,
  UserCircle2,
  X,
} from "lucide-react";

import {
  saveAppGuessAction,
  saveAppSpecialPickAction,
  saveOfficialAppResultAction,
  seedUsersIfMissingAction,
  syncAppSpecialPicksAction,
  updateUserRoleAction,
  verifyPrivilegedAccessAction,
} from "@/app/actions/match-actions";
import { BolaoNav } from "@/components/bolao-nav";
import { CountryFlag } from "@/components/country-flag";
import {
  gamesData,
  groupsData,
  participants,
  stageOrder,
  teamsById,
} from "@/data/gamesData";
import { initialState } from "@/data/initialState";
import {
  awardRules,
  buildRanking,
  formatCurrency,
  formatFullDateTime,
  formatKickoff,
  getPrediction,
  getPredictionAvailability,
  getPredictionReward,
  getSpecialPickAvailability,
  getSpecialPick,
  scoringRules,
  upsertPrediction,
  upsertResult,
  upsertSpecialPick,
} from "@/lib/bolao";
import {
  calculateAllStandings,
  calculateTournamentFinance,
  generateKnockoutBracket,
  rankThirdPlacedTeams,
  TOURNAMENT_INVESTMENT_TOTAL,
} from "@/lib/tournamentEngine";
import type {
  AppUserRole,
  AppState,
  MatchPoolBreakdown,
  MatchResult,
  Participant,
  Prediction,
  RankingEntry,
  ResolvedGame,
  SpecialPick,
  StandingEntry,
  Team,
} from "@/types/bolao";

type AppPageKey = "menu" | "acesso" | "palpites" | "ranking" | "admin";
type RemoteAppUser = { name: string; role: AppUserRole };
const LOCAL_STORAGE_PARTICIPANTS_KEY = "bolao-copa-2026-participants";
const LOCAL_STORAGE_STATE_KEY = "bolao-copa-2026-app-state";
const LOCAL_STORAGE_SELECTED_USER_KEY = "bolao-copa-2026-selected-user";
const LOCAL_STORAGE_PRIVILEGED_ACCESS_KEY = "bolao-copa-2026-privileged-access";
const participantAccentPalette = [
  "#10b981",
  "#0ea5e9",
  "#a855f7",
  "#f59e0b",
  "#f43f5e",
  "#3b82f6",
  "#84cc16",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#eab308",
  "#fb7185",
];

const tabTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.24, ease: "easeOut" as const },
};

const pageMeta: Record<
  AppPageKey,
  { label: string; description: string; icon: React.ReactNode }
> = {
  menu: {
    label: "Dashboard",
    description: "Proximos jogos e visao geral",
    icon: <Trophy className="h-4 w-4" />,
  },
  acesso: {
    label: "Acesso",
    description: "Entrar e ver regras",
    icon: <LogIn className="h-4 w-4" />,
  },
  palpites: {
    label: "Palpites",
    description: "Potes e trava de 1 min",
    icon: <Swords className="h-4 w-4" />,
  },
  ranking: {
    label: "Ranking",
    description: "Tabela e chaveamento",
    icon: <Medal className="h-4 w-4" />,
  },
  admin: {
    label: "Admin",
    description: "Resultados oficiais",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
};

function parseScoreInput(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(99, Math.trunc(parsed)));
}

function normalizeParticipantName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getRoleLabel(role: AppUserRole) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "moderator") {
    return "Moderador";
  }

  return "Usuario";
}

function formatCalendarDate(dateString: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(dateString));
}

function getCalendarDayKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function createParticipantId(name: string, existingParticipants: Participant[]) {
  const baseId =
    normalizeParticipantName(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "participante";

  let candidateId = baseId;
  let suffix = 2;

  while (existingParticipants.some((participant) => participant.id === candidateId)) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidateId;
}

function resolveParticipantRole(
  name: string,
  remoteRole: AppUserRole | null | undefined = null,
): AppUserRole {
  if (normalizeParticipantName(name).toLowerCase() === "bruno") {
    return "admin";
  }

  return remoteRole ?? "user";
}

function isPrivilegedRole(role: AppUserRole) {
  return role === "admin" || role === "moderator";
}

function mergeParticipants(
  existingParticipants: Participant[],
  incomingUsers: RemoteAppUser[],
) {
  const mergedParticipants = existingParticipants.map((participant) => ({
    ...participant,
    role: resolveParticipantRole(participant.name, participant.role),
  }));

  for (const incomingUser of incomingUsers) {
    const normalizedName = normalizeParticipantName(incomingUser.name);

    if (!normalizedName) {
      continue;
    }

    const alreadyExists = mergedParticipants.some(
      (participant) =>
        participant.name.localeCompare(normalizedName, "pt-BR", {
          sensitivity: "accent",
        }) === 0,
    );

    if (alreadyExists) {
      const existingIndex = mergedParticipants.findIndex(
        (participant) =>
          participant.name.localeCompare(normalizedName, "pt-BR", {
            sensitivity: "accent",
          }) === 0,
      );

      if (existingIndex >= 0) {
        mergedParticipants[existingIndex] = {
          ...mergedParticipants[existingIndex],
          role: resolveParticipantRole(normalizedName, incomingUser.role),
        };
      }
      continue;
    }

    mergedParticipants.push({
      id: createParticipantId(normalizedName, mergedParticipants),
      name: normalizedName,
      role: resolveParticipantRole(normalizedName, incomingUser.role),
      accentColor:
        participantAccentPalette[
          mergedParticipants.length % participantAccentPalette.length
        ],
    });
  }

  return mergedParticipants;
}

function mergeInitialResults(remoteResults: MatchResult[]) {
  const remoteResultsMap = new Map(
    remoteResults.map((result) => [result.gameId, result] as const),
  );

  return initialState.results.map(
    (result) => remoteResultsMap.get(result.gameId) ?? result,
  );
}

function mergeInitialPredictions(remotePredictions: Prediction[]) {
  const remotePredictionsMap = new Map(
    remotePredictions.map((prediction) => [
      `${prediction.userId}:${prediction.gameId}`,
      prediction,
    ] as const),
  );
  const mergedPredictions = initialState.predictions.map(
    (prediction) =>
      remotePredictionsMap.get(`${prediction.userId}:${prediction.gameId}`) ?? prediction,
  );

  for (const prediction of remotePredictions) {
    const key = `${prediction.userId}:${prediction.gameId}`;
    const alreadyExists = mergedPredictions.some(
      (existingPrediction) =>
        `${existingPrediction.userId}:${existingPrediction.gameId}` === key,
    );

    if (!alreadyExists) {
      mergedPredictions.push(prediction);
    }
  }

  return mergedPredictions;
}

function mergeInitialSpecialPicks(remoteSpecialPicks: SpecialPick[]) {
  const remoteSpecialPicksMap = new Map(
    remoteSpecialPicks.map((specialPick) => [specialPick.userId, specialPick] as const),
  );
  const mergedSpecialPicks = initialState.specialPicks.map(
    (specialPick) => remoteSpecialPicksMap.get(specialPick.userId) ?? specialPick,
  );

  for (const specialPick of remoteSpecialPicks) {
    const alreadyExists = mergedSpecialPicks.some(
      (existingSpecialPick) => existingSpecialPick.userId === specialPick.userId,
    );

    if (!alreadyExists) {
      mergedSpecialPicks.push(specialPick);
    }
  }

  return mergedSpecialPicks;
}

function createInitialAppState(
  initialOfficialResults: MatchResult[],
  initialAppPredictions: Prediction[],
  initialAppSpecialPicks: SpecialPick[],
) {
  const initialResults = mergeInitialResults(initialOfficialResults);
  const initialPredictions = mergeInitialPredictions(initialAppPredictions);
  const initialSpecialPicks = mergeInitialSpecialPicks(initialAppSpecialPicks);

  if (typeof window === "undefined") {
    return {
      ...initialState,
      predictions: initialPredictions,
      specialPicks: initialSpecialPicks,
      results: initialResults,
    };
  }

  try {
    const rawState = window.localStorage.getItem(LOCAL_STORAGE_STATE_KEY);

    if (!rawState) {
      return {
        ...initialState,
        predictions: initialPredictions,
        specialPicks: initialSpecialPicks,
        results: initialResults,
      };
    }

    const parsedState = JSON.parse(rawState) as Partial<AppState>;

    return {
      predictions: initialPredictions,
      specialPicks: Array.isArray(parsedState.specialPicks)
        ? mergeInitialSpecialPicks(parsedState.specialPicks as SpecialPick[])
        : initialSpecialPicks,
      results: initialResults,
      awards:
        parsedState.awards &&
        typeof parsedState.awards === "object" &&
        "champion" in parsedState.awards &&
        "topScorer" in parsedState.awards
          ? {
              champion:
                typeof parsedState.awards.champion === "string"
                  ? parsedState.awards.champion
                  : null,
              topScorer:
                typeof parsedState.awards.topScorer === "string"
                  ? parsedState.awards.topScorer
                  : null,
            }
          : initialState.awards,
    };
  } catch {
    return {
      ...initialState,
      predictions: initialPredictions,
      specialPicks: initialSpecialPicks,
      results: initialResults,
    };
  }
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-surface rounded-2xl p-4 transition-transform duration-300 hover:scale-[1.01] md:rounded-3xl md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3 md:mb-5 md:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bolao-accent/80 md:text-sm md:tracking-[0.24em]">
            {title}
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-tight text-white md:text-2xl">
            {subtitle}
          </h2>
        </div>
        <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/80 p-2.5 text-emerald-300 md:p-3">
          {icon}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="glass-surface rounded-2xl p-3 transition-transform duration-300 hover:scale-[1.02] md:p-4">
      <p className="text-xs text-bolao-muted md:text-sm">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white md:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: AppUserRole }) {
  const toneClassName =
    role === "admin"
      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
      : role === "moderator"
        ? "border-sky-300/20 bg-sky-300/10 text-sky-100"
        : "border-white/10 bg-white/5 text-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClassName}`}
    >
      {getRoleLabel(role)}
    </span>
  );
}

function AccessStateCard({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <SectionCard
      title="Acesso"
      subtitle={title}
      icon={<Lock className="h-6 w-6" />}
    >
      <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
        {description}
      </div>
      <Link
        href={actionHref}
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/15"
      >
        {actionLabel}
      </Link>
    </SectionCard>
  );
}

function DashboardGameRow({
  game,
  result,
}: {
  game: ResolvedGame;
  result: MatchResult | undefined;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            {game.roundLabel} Â· Jogo {game.matchNumber}
          </p>
          <div className="mt-2 flex flex-col gap-2 text-sm font-semibold text-white sm:flex-row sm:items-center">
            <TeamLabel team={game.homeTeam} fallback="A definir" />
            <span className="text-slate-500">x</span>
            <TeamLabel team={game.awayTeam} fallback="A definir" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <p>{formatKickoff(game.kickoff)}</p>
          <p className="mt-1 text-xs text-slate-500">{game.stadium}</p>
        </div>
      </div>
      {result?.finished && result.homeScore !== null && result.awayScore !== null && (
        <p className="mt-3 text-sm text-emerald-200">
          Ultimo resultado:{" "}
          <span className="font-semibold text-white">
            {result.homeScore} x {result.awayScore}
          </span>
        </p>
      )}
    </div>
  );
}

const GUESS_DOT_GRAY = "#64748b";

function getGuessStatus(
  prediction: Prediction | undefined,
  result: MatchResult | undefined,
) {
  const hasGuess =
    Boolean(prediction) &&
    prediction?.homeScore !== null &&
    prediction?.awayScore !== null;
  const isFinished =
    Boolean(result?.finished) &&
    result?.homeScore !== null &&
    result?.awayScore !== null;

  if (!isFinished) {
    return {
      hasGuess,
      dotColor: GUESS_DOT_GRAY,
      label: hasGuess ? "Palpite salvo" : "Aguardando palpite",
      labelClassName: "text-slate-400",
    };
  }

  if (!hasGuess || !prediction) {
    return {
      hasGuess,
      dotColor: GUESS_DOT_GRAY,
      label: "Nao palpitou",
      labelClassName: "text-slate-500",
    };
  }

  const home = prediction.homeScore as number;
  const away = prediction.awayScore as number;
  const resultHome = result?.homeScore as number;
  const resultAway = result?.awayScore as number;

  if (home === resultHome && away === resultAway) {
    return {
      hasGuess,
      dotColor: "#10b981",
      label: "Cravou",
      labelClassName: "text-emerald-200",
    };
  }

  const outcome = (h: number, a: number) =>
    h > a ? "home" : a > h ? "away" : "draw";
  const resultHit = outcome(home, away) === outcome(resultHome, resultAway);
  const goalsHit = home + away === resultHome + resultAway;

  if (resultHit || goalsHit) {
    return {
      hasGuess,
      dotColor: "#f59e0b",
      label:
        resultHit && goalsHit
          ? "Resultado + gols"
          : resultHit
            ? "Resultado"
            : "Gols",
      labelClassName: "text-amber-200",
    };
  }

  return {
    hasGuess,
    dotColor: "#f43f5e",
    label: "Errou",
    labelClassName: "text-rose-300",
  };
}

function DailyGuessesCard({
  dayLabel,
  games,
  participants,
  predictions,
  results,
}: {
  dayLabel: string;
  games: ResolvedGame[];
  participants: Participant[];
  predictions: Prediction[];
  results: MatchResult[];
}) {
  return (
    <SectionCard
      title="Palpites do Dia"
      subtitle={`Veja os palpites de todos nos jogos de ${dayLabel}`}
      icon={<Swords className="h-6 w-6" />}
    >
      {games.length ? (
        <div className="space-y-4">
          {games.map((game) => {
            const result = results.find((item) => item.gameId === game.id);
            const isFinished =
              Boolean(result?.finished) &&
              result?.homeScore !== null &&
              result?.awayScore !== null;

            return (
              <div
                key={game.id}
                className="rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {game.roundLabel} Â· Jogo {game.matchNumber}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                      <TeamLabel team={game.homeTeam} fallback="A definir" />
                      <span className="text-slate-500">x</span>
                      <TeamLabel team={game.awayTeam} fallback="A definir" />
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>{formatKickoff(game.kickoff)}</p>
                    {isFinished ? (
                      <p className="mt-1 text-sm font-semibold text-emerald-200">
                        {result?.homeScore} x {result?.awayScore}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8 bg-black/20">
                  <table className="min-w-full text-left text-xs sm:text-sm">
                    <thead className="bg-white/5 text-slate-300">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Participante</th>
                        <th className="px-3 py-2.5 font-medium">Palpite</th>
                        <th className="px-3 py-2.5 font-medium">Situacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant) => {
                        const prediction = getPrediction(
                          predictions,
                          participant.id,
                          game.id,
                        );
                        const status = getGuessStatus(prediction, result);

                        return (
                          <tr
                            key={participant.id}
                            className="border-t border-white/8 text-slate-200"
                          >
                            <td className="px-3 py-2.5 font-medium text-white">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: status.dotColor }}
                                />
                                <span className="truncate">{participant.name}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {status.hasGuess ? (
                                <span className="font-semibold text-white">
                                  {prediction?.homeScore} x {prediction?.awayScore}
                                </span>
                              ) : (
                                <span className="text-slate-500">Aguardando palpite</span>
                              )}
                            </td>
                            <td className={`px-3 py-2.5 ${status.labelClassName}`}>
                              {status.label}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
          Nenhum jogo encontrado para hoje no calendario.
        </div>
      )}
    </SectionCard>
  );
}

function TeamLabel({
  team,
  fallback,
}: {
  team: Team | null;
  fallback?: string;
}) {
  if (!team) {
    return <span className="text-slate-500">{fallback ?? "A definir"}</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <CountryFlag code={team.code} name={team.name} />
      <span>{team.name}</span>
    </span>
  );
}

function StandingsTable({
  standings,
}: {
  standings: StandingEntry[];
}) {
  return (
    <div className="glass-surface premium-scrollbar min-w-0 max-w-full overflow-x-auto rounded-3xl">
      <table className="min-w-[38rem] text-left text-[11px] sm:min-w-full sm:text-xs md:text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">Pos</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">Selecao</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">PTS</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">J</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">V</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">E</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">D</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">GP</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">GC</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3">SG</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry) => (
            <tr key={entry.teamId} className="border-t border-white/8 text-slate-200">
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.position}</td>
              <td className="px-2 py-2.5 font-medium text-white sm:px-3 sm:py-3">
                <span className="inline-flex items-center gap-1.5 sm:gap-2">
                  <CountryFlag code={entry.team.code} name={entry.team.name} />
                  {entry.team.shortName}
                </span>
              </td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.points}</td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.played}</td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.wins}</td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.draws}</td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.losses}</td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.goalsFor}</td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.goalsAgainst}</td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">{entry.goalDifference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingTable({
  ranking,
}: {
  ranking: RankingEntry[];
}) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-3xl border border-white/8 bg-black/20">
      <table className="min-w-[58rem] text-left text-[11px] sm:text-xs md:min-w-full md:text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">Pos.</th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">Participante</th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">Ganhos por Jogos</th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">
              Acerto de Contas (Liquido)
            </th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">Premios Finais</th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">Cravos</th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">
              Resultados certos
            </th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">Campeao</th>
            <th className="px-2 py-2.5 font-medium sm:px-3 md:px-4 md:py-3">Artilheiro</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((entry, index) => (
            <tr key={entry.userId} className="border-t border-white/8 text-slate-200">
              <td className="px-2 py-2.5 sm:px-3 md:px-4 md:py-3">{index + 1}</td>
              <td className="px-2 py-2.5 font-medium text-white sm:px-3 md:px-4 md:py-3">
                {entry.name}
              </td>
              <td className="px-2 py-2.5 font-semibold text-white sm:px-3 md:px-4 md:py-3">
                {formatCurrency(entry.matchWinnings)}
              </td>
              <td className="px-2 py-2.5 sm:px-3 md:px-4 md:py-3">
                <span
                  className={`font-semibold ${
                    entry.netSettlement > 0
                      ? "text-emerald-300"
                      : entry.netSettlement < 0
                        ? "text-rose-300"
                        : "text-bolao-zero"
                  }`}
                >
                  {entry.netSettlement > 0 ? "+" : ""}
                  {formatCurrency(entry.netSettlement)} Â· {entry.settlementLabel}
                </span>
              </td>
              <td className="px-2 py-2.5 sm:px-3 md:px-4 md:py-3">
                {formatCurrency(entry.finalAwardsWinnings)}
              </td>
              <td className="px-2 py-2.5 sm:px-3 md:px-4 md:py-3">{entry.exactHits}</td>
              <td className="px-2 py-2.5 sm:px-3 md:px-4 md:py-3">{entry.resultHits}</td>
              <td className="px-2 py-2.5 sm:px-3 md:px-4 md:py-3">
                {entry.championHit ? "Sim" : "Nao"}
              </td>
              <td className="px-2 py-2.5 sm:px-3 md:px-4 md:py-3">
                {entry.topScorerHit ? "Sim" : "Nao"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BracketColumn({
  title,
  games,
  state,
}: {
  title: string;
  games: ResolvedGame[];
  state: AppState;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="glass-surface rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      {games.map((game) => {
        const result = state.results.find((item) => item.gameId === game.id);

        return (
          <div
            key={game.id}
            className="glass-surface rounded-2xl p-4 transition-transform duration-300 hover:scale-[1.02]"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Jogo {game.matchNumber}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="rounded-xl bg-white/5 px-3 py-2 text-white">
                <TeamLabel team={game.homeTeam} />
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2 text-white">
                <TeamLabel team={game.awayTeam} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {result?.finished &&
              result.homeScore !== null &&
              result.awayScore !== null
                ? `Resultado: ${result.homeScore} x ${result.awayScore}`
                : formatKickoff(game.kickoff)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function PredictionGameCard({
  game,
  selectedUserId,
  selectedParticipant,
  predictions,
  results,
  breakdown,
  now,
  onPredictionChange,
  onSaveRequest,
  onSaveConfirm,
  isSaving,
  isConfirming,
  feedbackMessage,
  errorMessage,
}: {
  game: ResolvedGame;
  selectedUserId: string | null;
  selectedParticipant: { id: string; name: string } | null;
  predictions: AppState["predictions"];
  results: AppState["results"];
  breakdown?: MatchPoolBreakdown;
  now: Date;
  onPredictionChange: (
    gameId: string,
    side: "homeScore" | "awayScore",
    value: string,
  ) => void;
  onSaveRequest: (gameId: string) => void;
  onSaveConfirm: (gameId: string) => void;
  isSaving: boolean;
  isConfirming: boolean;
  feedbackMessage: string;
  errorMessage: string;
}) {
  const prediction = selectedUserId
    ? getPrediction(predictions, selectedUserId, game.id)
    : undefined;
  const result = results.find((item) => item.gameId === game.id);
  const reward = getPredictionReward(prediction, result, breakdown);
  const availability = getPredictionAvailability(game, now);
  const isEditable = Boolean(selectedParticipant) && availability.status === "open";
  const canSavePrediction =
    Boolean(selectedParticipant) &&
    availability.status === "open" &&
    prediction?.homeScore !== null &&
    prediction?.awayScore !== null;
  const totalGamePot = breakdown
    ? breakdown.totalPot.result + breakdown.totalPot.goals + breakdown.totalPot.exact
    : 0;

  return (
    <article className="glass-surface rounded-2xl p-3 transition-transform duration-300 hover:scale-[1.02] md:rounded-3xl md:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Jogo {game.matchNumber}
              {game.matchdayLabel ? ` Â· ${game.matchdayLabel}` : ""}
            </p>
            <div className="mt-2 flex flex-col items-center gap-2 text-center text-sm font-semibold text-white sm:flex-row sm:justify-start sm:text-base">
              <TeamLabel team={game.homeTeam} fallback="A definir" />
              <span className="text-slate-500">x</span>
              <TeamLabel team={game.awayTeam} fallback="A definir" />
            </div>
          </div>

          <div className="w-full rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 px-4 py-3 text-sm text-slate-300 sm:w-auto">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-300" />
              <span>{formatKickoff(game.kickoff)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{game.stadium}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {game.homeTeam?.shortName ?? "Time A"}
                </p>
                <div className="flex justify-center">
                  <CountryFlag
                    code={game.homeTeam?.code}
                    name={game.homeTeam?.name ?? "Time A"}
                    sizeClassName="h-10 w-10"
                  />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  disabled={!isEditable}
                  value={prediction?.homeScore ?? ""}
                  onChange={(event) =>
                    onPredictionChange(game.id, "homeScore", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50 md:px-4 md:text-xl"
                />
              </div>

              <span className="pt-7 text-xl font-semibold text-slate-500">x</span>

              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {game.awayTeam?.shortName ?? "Time B"}
                </p>
                <div className="flex justify-center">
                  <CountryFlag
                    code={game.awayTeam?.code}
                    name={game.awayTeam?.name ?? "Time B"}
                    sizeClassName="h-10 w-10"
                  />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  disabled={!isEditable}
                  value={prediction?.awayScore ?? ""}
                  onChange={(event) =>
                    onPredictionChange(game.id, "awayScore", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50 md:px-4 md:text-xl"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Status do palpite</p>
            <div className="mt-3 flex items-start gap-2">
              {availability.status === "open" ? (
                <Unlock className="mt-0.5 h-4 w-4 text-emerald-300" />
              ) : availability.status === "locked" ? (
                <Lock className="mt-0.5 h-4 w-4 text-rose-300" />
              ) : (
                <Clock3 className="mt-0.5 h-4 w-4 text-amber-300" />
              )}
              <p>{availability.message}</p>
            </div>
            <p className="mt-2">
              Resultado oficial:{" "}
              <span className="font-semibold text-white">
                {result &&
                result.homeScore !== null &&
                result.awayScore !== null
                  ? `${result.homeScore} x ${result.awayScore}`
                  : "aguardando"}
              </span>
            </p>
            <p className="mt-2">
              Meu palpite:{" "}
              <span className="font-semibold text-white">
                {prediction &&
                prediction.homeScore !== null &&
                prediction.awayScore !== null
                  ? `${prediction.homeScore} x ${prediction.awayScore}`
                  : "nao informado"}
              </span>
            </p>
            <p className="mt-2">
              Ganho neste jogo:{" "}
              <span
                className={`font-semibold ${
                  reward.amount > 0 ? "text-emerald-300" : "text-bolao-zero"
                }`}
              >
                {formatCurrency(reward.amount)}
              </span>
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Pote atual: {formatCurrency(totalGamePot)}
            </p>
            <button
              type="button"
              onClick={() => onSaveRequest(game.id)}
              disabled={!canSavePrediction || isSaving}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Salvar palpite"}
            </button>

            {isConfirming && (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                <p className="font-medium text-white">
                  Confirmar salvamento deste palpite?
                </p>
                <p className="mt-1 text-amber-100/90">
                  Palpite: {prediction?.homeScore ?? "-"} x {prediction?.awayScore ?? "-"}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onSaveConfirm(game.id)}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/15 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/20"
                  >
                    Confirmar e salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveRequest("")}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {feedbackMessage && (
              <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                {feedbackMessage}
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-100">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function AdminResultGameCard({
  game,
  result,
  onResultChange,
  onResultFinished,
  onSaveRequest,
  onSaveConfirm,
  isSaving,
  isConfirming,
}: {
  game: ResolvedGame;
  result: MatchResult | undefined;
  onResultChange: (
    gameId: string,
    side: "homeScore" | "awayScore",
    value: string,
  ) => void;
  onResultFinished: (gameId: string, finished: boolean) => void;
  onSaveRequest: (gameId: string) => void;
  onSaveConfirm: (gameId: string) => void;
  isSaving: boolean;
  isConfirming: boolean;
}) {
  return (
    <article className="glass-surface rounded-2xl p-3 transition-transform duration-300 hover:scale-[1.02] md:rounded-3xl md:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Jogo {game.matchNumber}
              {game.matchdayLabel ? ` Â· ${game.matchdayLabel}` : ""}
            </p>
            <div className="mt-2 flex flex-col items-center gap-2 text-center text-sm font-semibold text-white sm:flex-row sm:justify-start sm:text-base">
              <TeamLabel team={game.homeTeam} fallback="A definir" />
              <span className="text-slate-500">x</span>
              <TeamLabel team={game.awayTeam} fallback="A definir" />
            </div>
          </div>

          <div className="w-full rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 px-4 py-3 text-sm text-slate-300 sm:w-auto">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-300" />
              <span>{formatKickoff(game.kickoff)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{game.stadium}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {game.homeTeam?.shortName ?? "Time A"}
                </p>
                <div className="flex justify-center">
                  <CountryFlag
                    code={game.homeTeam?.code}
                    name={game.homeTeam?.name ?? "Time A"}
                    sizeClassName="h-10 w-10"
                  />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={result?.homeScore ?? ""}
                  onChange={(event) =>
                    onResultChange(game.id, "homeScore", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60 md:px-4 md:text-xl"
                />
              </div>

              <span className="pt-7 text-xl font-semibold text-slate-500">x</span>

              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {game.awayTeam?.shortName ?? "Time B"}
                </p>
                <div className="flex justify-center">
                  <CountryFlag
                    code={game.awayTeam?.code}
                    name={game.awayTeam?.name ?? "Time B"}
                    sizeClassName="h-10 w-10"
                  />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={result?.awayScore ?? ""}
                  onChange={(event) =>
                    onResultChange(game.id, "awayScore", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60 md:px-4 md:text-xl"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Resultado oficial</p>
            <label className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={result?.finished ?? false}
                onChange={(event) => onResultFinished(game.id, event.target.checked)}
              />
              Encerrado
            </label>
            <p className="mt-3">
              Status atual:{" "}
              <span className="font-semibold text-white">
                {result?.finished ? "encerrado" : "agendado"}
              </span>
            </p>
            <p className="mt-2">
              Placar salvo:{" "}
              <span className="font-semibold text-white">
                {result &&
                result.homeScore !== null &&
                result.awayScore !== null
                  ? `${result.homeScore} x ${result.awayScore}`
                  : "aguardando"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => onSaveRequest(game.id)}
              disabled={isSaving}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Salvar resultado"}
            </button>

            {isConfirming && (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                <p className="font-medium text-white">Confirmar salvamento deste resultado?</p>
                <p className="mt-1 text-amber-100/90">
                  Placar: {result?.homeScore ?? "-"} x {result?.awayScore ?? "-"} Â·{" "}
                  {result?.finished ? "Encerrado" : "Agendado"}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onSaveConfirm(game.id)}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/15 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/20"
                  >
                    Confirmar e salvar no banco
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveRequest("")}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function BolaoApp({
  currentPage,
  initialRemoteUsers = [],
  initialOfficialResults = [],
  initialAppPredictions = [],
  initialAppSpecialPicks = [],
}: {
  currentPage: AppPageKey;
  initialRemoteUsers?: RemoteAppUser[];
  initialOfficialResults?: MatchResult[];
  initialAppPredictions?: Prediction[];
  initialAppSpecialPicks?: SpecialPick[];
}) {
  const router = useRouter();
  const [participantList, setParticipantList] = useState<Participant[]>(() => {
    const baseParticipants = mergeParticipants(participants, initialRemoteUsers);

    if (typeof window === "undefined") {
      return baseParticipants;
    }

    try {
      const rawParticipants = window.localStorage.getItem(
        LOCAL_STORAGE_PARTICIPANTS_KEY,
      );

      if (!rawParticipants) {
        return baseParticipants;
      }

      const parsedParticipants = JSON.parse(rawParticipants) as Participant[];

      if (!Array.isArray(parsedParticipants) || !parsedParticipants.length) {
        return baseParticipants;
      }

      return parsedParticipants.reduce<Participant[]>((accumulator, participant) => {
        if (
          participant &&
          typeof participant.id === "string" &&
          typeof participant.name === "string" &&
          typeof participant.accentColor === "string" &&
          !accumulator.some((existing) => existing.id === participant.id)
        ) {
          accumulator.push({
            ...participant,
            role: resolveParticipantRole(
              participant.name,
              "role" in participant ? participant.role : null,
            ),
          });
        }

        return accumulator;
      }, [...baseParticipants]);
    } catch {
      return baseParticipants;
    }
  });
  const [state, setState] = useState<AppState>(() =>
    createInitialAppState(
      initialOfficialResults,
      initialAppPredictions,
      initialAppSpecialPicks,
    ),
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return window.localStorage.getItem(LOCAL_STORAGE_SELECTED_USER_KEY);
    } catch {
      return null;
    }
  });
  const [verifiedPrivilegedAccess, setVerifiedPrivilegedAccess] = useState<Record<string, boolean>>(
    () => {
      if (typeof window === "undefined") {
        return {};
      }

      try {
        const rawAccess = window.localStorage.getItem(LOCAL_STORAGE_PRIVILEGED_ACCESS_KEY);

        if (!rawAccess) {
          return {};
        }

        const parsedAccess = JSON.parse(rawAccess) as Record<string, boolean>;

        return parsedAccess && typeof parsedAccess === "object" ? parsedAccess : {};
      } catch {
        return {};
      }
    },
  );
  const [isCreateParticipantOpen, setIsCreateParticipantOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [participantFormError, setParticipantFormError] = useState("");
  const [participantFormSuccess, setParticipantFormSuccess] = useState("");
  const [isSavingParticipant, startSavingParticipant] = useTransition();
  const [isVerifyingPrivilegedAccess, startVerifyingPrivilegedAccess] = useTransition();
  const [isSavingOfficialResult, startSavingOfficialResult] = useTransition();
  const [isSavingPrediction, startSavingPrediction] = useTransition();
  const [savingOfficialGameId, setSavingOfficialGameId] = useState<string | null>(null);
  const [confirmingOfficialGameId, setConfirmingOfficialGameId] = useState<string | null>(
    null,
  );
  const [savingPredictionGameId, setSavingPredictionGameId] = useState<string | null>(null);
  const [confirmingPredictionGameId, setConfirmingPredictionGameId] = useState<string | null>(
    null,
  );
  const [adminResultFeedback, setAdminResultFeedback] = useState("");
  const [adminResultError, setAdminResultError] = useState("");
  const [predictionFeedbackGameId, setPredictionFeedbackGameId] = useState<string | null>(
    null,
  );
  const [predictionFeedback, setPredictionFeedback] = useState("");
  const [predictionErrorGameId, setPredictionErrorGameId] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState("");
  const [isSavingSpecialPick, startSavingSpecialPick] = useTransition();
  const [specialPickFeedback, setSpecialPickFeedback] = useState("");
  const [specialPickError, setSpecialPickError] = useState("");
  const [pendingPrivilegedParticipantId, setPendingPrivilegedParticipantId] = useState<
    string | null
  >(null);
  const [privilegedPassword, setPrivilegedPassword] = useState("");
  const [privilegedAccessError, setPrivilegedAccessError] = useState("");
  const [roleDraftOverrides, setRoleDraftOverrides] = useState<Record<string, AppUserRole>>(() =>
    Object.fromEntries(participants.map((participant) => [participant.id, participant.role])),
  );
  const [isSavingUserRole, startSavingUserRole] = useTransition();
  const [savingRoleUserId, setSavingRoleUserId] = useState<string | null>(null);
  const [userRoleFeedback, setUserRoleFeedback] = useState("");
  const [userRoleError, setUserRoleError] = useState("");
  const didSyncInitialSpecialPicksRef = useRef(false);

  const now = new Date();
  const rawSelectedParticipant =
    participantList.find((participant) => participant.id === selectedUserId) ?? null;
  const selectedParticipant =
    rawSelectedParticipant &&
    (!isPrivilegedRole(rawSelectedParticipant.role) ||
      verifiedPrivilegedAccess[rawSelectedParticipant.id] === true)
      ? rawSelectedParticipant
      : null;
  const pendingPrivilegedParticipant =
    participantList.find((participant) => participant.id === pendingPrivilegedParticipantId) ??
    null;
  const effectiveSelectedUserId = selectedParticipant?.id ?? null;
  const isLoggedIn = Boolean(selectedParticipant);
  const currentUserRole = selectedParticipant?.role ?? null;
  const canAccessAdmin =
    currentUserRole === "admin" || currentUserRole === "moderator";
  const canManageUsers = currentUserRole === "admin";

  const standingsByGroup = useMemo(
    () => calculateAllStandings(groupsData, gamesData, state.results, teamsById),
    [state.results],
  );
  const bestThirds = useMemo(
    () => rankThirdPlacedTeams(standingsByGroup),
    [standingsByGroup],
  );
  const knockout = useMemo(
    () => generateKnockoutBracket(gamesData, standingsByGroup, state.results, teamsById),
    [standingsByGroup, state.results],
  );

  const groupResolvedGames = useMemo(
    () =>
      gamesData
        .filter((game) => game.stage === "group")
        .map((game) => ({
          ...game,
          homeTeam: game.homeTeamId ? teamsById[game.homeTeamId] : null,
          awayTeam: game.awayTeamId ? teamsById[game.awayTeamId] : null,
        })),
    [],
  );

  const allResolvedGames = useMemo(
    () =>
      [...groupResolvedGames, ...knockout.games].sort(
        (left, right) => left.matchNumber - right.matchNumber,
      ),
    [groupResolvedGames, knockout.games],
  );
  const chronologicalGames = useMemo(
    () =>
      [...allResolvedGames].sort(
        (left, right) =>
          new Date(left.kickoff).getTime() - new Date(right.kickoff).getTime() ||
          left.matchNumber - right.matchNumber,
      ),
    [allResolvedGames],
  );

  const ranking = useMemo(
    () => buildRanking(participantList, allResolvedGames, state),
    [allResolvedGames, participantList, state],
  );
  const financeSummary = useMemo(
    () => calculateTournamentFinance(participantList, allResolvedGames, state),
    [allResolvedGames, participantList, state],
  );

  const predictionsCount = state.predictions.filter(
    (prediction) =>
      prediction.homeScore !== null && prediction.awayScore !== null,
  ).length;
  const finishedGamesCount = state.results.filter((result) => result.finished).length;
  const exactLeaderCount = Math.max(...ranking.map((entry) => entry.exactHits), 0);
  const exactLeaders = ranking.filter(
    (entry) => exactLeaderCount > 0 && entry.exactHits === exactLeaderCount,
  );
  const championWinners = ranking.filter((entry) => entry.championHit);
  const topScorerWinners = ranking.filter((entry) => entry.topScorerHit);
  const currentRollover = useMemo(() => {
    const lastGame = allResolvedGames[allResolvedGames.length - 1];

    if (!lastGame) {
      return { result: 0, goals: 0, exact: 0 };
    }

    return (
      financeSummary.matchBreakdowns[lastGame.id]?.rolloverOut ?? {
        result: 0,
        goals: 0,
        exact: 0,
      }
    );
  }, [allResolvedGames, financeSummary.matchBreakdowns]);
  const upcomingGames = chronologicalGames
    .filter((game) => new Date(game.kickoff).getTime() >= now.getTime())
    .slice(0, 6);
  const dailyGuesses = (() => {
    const todayKey = getCalendarDayKey(now.toISOString());
    const todayGames = chronologicalGames.filter(
      (game) => getCalendarDayKey(game.kickoff) === todayKey,
    );

    if (todayGames.length) {
      return { dayLabel: formatCalendarDate(now.toISOString()), games: todayGames };
    }

    const nextGame = chronologicalGames.find(
      (game) => new Date(game.kickoff).getTime() >= now.getTime(),
    );

    if (!nextGame) {
      return { dayLabel: formatCalendarDate(now.toISOString()), games: [] as ResolvedGame[] };
    }

    const nextKey = getCalendarDayKey(nextGame.kickoff);

    return {
      dayLabel: formatCalendarDate(nextGame.kickoff),
      games: chronologicalGames.filter(
        (game) => getCalendarDayKey(game.kickoff) === nextKey,
      ),
    };
  })();
  const predictionGamesByDate = useMemo(() => {
    const groups = chronologicalGames.reduce<
      Array<{ dayKey: string; label: string; games: ResolvedGame[] }>
    >((accumulator, game) => {
      const dayKey = getCalendarDayKey(game.kickoff);
      const existingGroup = accumulator[accumulator.length - 1];

      if (!existingGroup || existingGroup.dayKey !== dayKey) {
        accumulator.push({
          dayKey,
          label: formatCalendarDate(game.kickoff),
          games: [game],
        });
        return accumulator;
      }

      existingGroup.games.push(game);
      return accumulator;
    }, []);

    return groups;
  }, [chronologicalGames]);
  const openPredictionsCount = effectiveSelectedUserId
    ? chronologicalGames.filter((game) => {
        const availability = getPredictionAvailability(game, now);
        return availability.status === "open";
      }).length
    : 0;
  const pendingPredictionsCount = effectiveSelectedUserId
    ? chronologicalGames.filter((game) => {
        const availability = getPredictionAvailability(game, now);
        const prediction = getPrediction(state.predictions, effectiveSelectedUserId, game.id);

        return (
          availability.status === "open" &&
          (!prediction ||
            prediction.homeScore === null ||
            prediction.awayScore === null)
        );
      }).length
    : 0;
  const officialGamesByDate = useMemo(() => {
    const groups = chronologicalGames.reduce<
      Array<{ dayKey: string; label: string; games: ResolvedGame[] }>
    >((accumulator, game) => {
      const dayKey = getCalendarDayKey(game.kickoff);
      const existingGroup = accumulator[accumulator.length - 1];

      if (!existingGroup || existingGroup.dayKey !== dayKey) {
        accumulator.push({
          dayKey,
          label: formatCalendarDate(game.kickoff),
          games: [game],
        });
        return accumulator;
      }

      existingGroup.games.push(game);
      return accumulator;
    }, []);

    return groups;
  }, [chronologicalGames]);
  const finishedOfficialResultsCount = state.results.filter((result) => result.finished).length;
  const pendingOfficialResultsCount = chronologicalGames.length - finishedOfficialResultsCount;
  const firstTournamentKickoff = gamesData
    .slice()
    .sort(
      (left, right) =>
        new Date(left.kickoff).getTime() - new Date(right.kickoff).getTime(),
    )[0]?.kickoff;
  const specialPickAvailability = firstTournamentKickoff
    ? getSpecialPickAvailability(firstTournamentKickoff, now)
    : { status: "locked" as const, message: "Calendario indisponivel" };
  const currentPageInfo = pageMeta[currentPage];

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOCAL_STORAGE_PARTICIPANTS_KEY,
        JSON.stringify(participantList),
      );
    } catch {
      // Ignora indisponibilidade do storage para manter a tela funcional.
    }
  }, [participantList]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignora indisponibilidade do storage para manter a tela funcional.
    }
  }, [state]);

  useEffect(() => {
    if (didSyncInitialSpecialPicksRef.current) {
      return;
    }

    didSyncInitialSpecialPicksRef.current = true;

    const picksToSync = state.specialPicks.filter(
      (pick) => pick.champion.trim() || pick.topScorer.trim(),
    );

    if (!picksToSync.length) {
      return;
    }

    startSavingSpecialPick(async () => {
      try {
        await syncAppSpecialPicksAction(picksToSync);
      } catch {
        // Mantem os dados locais ativos mesmo se o sync inicial falhar.
      }
    });
  }, [state.specialPicks, startSavingSpecialPick]);

  useEffect(() => {
    try {
      if (selectedUserId) {
        window.localStorage.setItem(LOCAL_STORAGE_SELECTED_USER_KEY, selectedUserId);
      } else {
        window.localStorage.removeItem(LOCAL_STORAGE_SELECTED_USER_KEY);
      }
    } catch {
      // Ignora indisponibilidade do storage para manter a tela funcional.
    }
  }, [selectedUserId]);

  useEffect(() => {
    try {
      const hasAnyVerifiedAccess = Object.values(verifiedPrivilegedAccess).some(Boolean);

      if (hasAnyVerifiedAccess) {
        window.localStorage.setItem(
          LOCAL_STORAGE_PRIVILEGED_ACCESS_KEY,
          JSON.stringify(verifiedPrivilegedAccess),
        );
      } else {
        window.localStorage.removeItem(LOCAL_STORAGE_PRIVILEGED_ACCESS_KEY);
      }
    } catch {
      // Ignora indisponibilidade do storage para manter a tela funcional.
    }
  }, [verifiedPrivilegedAccess]);

  const roleDrafts = useMemo(
    () =>
      Object.fromEntries(
        participantList.map((participant) => [
          participant.id,
          roleDraftOverrides[participant.id] ?? participant.role,
        ]),
      ) as Record<string, AppUserRole>,
    [participantList, roleDraftOverrides],
  );

  function handlePredictionChange(
    gameId: string,
    side: "homeScore" | "awayScore",
    value: string,
  ) {
    if (!effectiveSelectedUserId) {
      return;
    }

    const game = allResolvedGames.find((item) => item.id === gameId);

    if (!game || getPredictionAvailability(game, now).status !== "open") {
      return;
    }

    if (confirmingPredictionGameId === gameId) {
      setConfirmingPredictionGameId(null);
    }
    if (predictionFeedbackGameId === gameId) {
      setPredictionFeedbackGameId(null);
      setPredictionFeedback("");
    }
    if (predictionErrorGameId === gameId) {
      setPredictionErrorGameId(null);
      setPredictionError("");
    }

    setState((currentState) => {
      const existingPrediction = getPrediction(
        currentState.predictions,
        effectiveSelectedUserId,
        gameId,
      );

      const nextPrediction: Prediction = {
        userId: effectiveSelectedUserId,
        gameId,
        homeScore:
          side === "homeScore"
            ? parseScoreInput(value)
            : existingPrediction?.homeScore ?? null,
        awayScore:
          side === "awayScore"
            ? parseScoreInput(value)
            : existingPrediction?.awayScore ?? null,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...currentState,
        predictions: upsertPrediction(currentState.predictions, nextPrediction),
      };
    });
  }

  function requestPredictionSave(gameId: string) {
    setConfirmingPredictionGameId(gameId || null);
    setPredictionFeedbackGameId(null);
    setPredictionFeedback("");
    setPredictionErrorGameId(null);
    setPredictionError("");
  }

  function persistPrediction(gameId: string) {
    if (!effectiveSelectedUserId) {
      setPredictionErrorGameId(gameId);
      setPredictionError("Selecione um participante antes de salvar o palpite.");
      return;
    }

    const game = allResolvedGames.find((item) => item.id === gameId);
    const prediction = getPrediction(state.predictions, effectiveSelectedUserId, gameId);

    if (!game || getPredictionAvailability(game, now).status !== "open") {
      setPredictionErrorGameId(gameId);
      setPredictionError("A janela para salvar este palpite esta fechada.");
      return;
    }

    if (prediction?.homeScore === null || prediction?.awayScore === null || !prediction) {
      setPredictionErrorGameId(gameId);
      setPredictionError("Informe os dois placares antes de salvar o palpite.");
      return;
    }

    setSavingPredictionGameId(gameId);
    setConfirmingPredictionGameId(null);
    setPredictionFeedbackGameId(null);
    setPredictionFeedback("");
    setPredictionErrorGameId(null);
    setPredictionError("");

    startSavingPrediction(async () => {
      try {
        const response = await saveAppGuessAction({
          userId: effectiveSelectedUserId,
          gameId,
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
        });

        setState((currentState) => ({
          ...currentState,
          predictions: upsertPrediction(
            currentState.predictions,
            response.prediction,
          ),
        }));
        setPredictionFeedbackGameId(gameId);
        setPredictionFeedback(`Palpite do jogo ${game.matchNumber} salvo com sucesso.`);
      } catch (error) {
        setPredictionErrorGameId(gameId);
        setPredictionError(
          error instanceof Error ? error.message : "Nao foi possivel salvar o palpite.",
        );
      } finally {
        setSavingPredictionGameId(null);
      }
    });
  }

  function handleSpecialPickChange(field: "champion" | "topScorer", value: string) {
    if (!effectiveSelectedUserId || specialPickAvailability.status !== "open") {
      return;
    }

    setSpecialPickFeedback("");
    setSpecialPickError("");

    setState((currentState) => {
      const currentSpecialPick = getSpecialPick(
        currentState.specialPicks,
        effectiveSelectedUserId,
      );
      const nextSpecialPick: SpecialPick = {
        userId: effectiveSelectedUserId,
        champion:
          field === "champion" ? value : currentSpecialPick?.champion ?? "",
        topScorer:
          field === "topScorer" ? value : currentSpecialPick?.topScorer ?? "",
        updatedAt: new Date().toISOString(),
      };

      return {
        ...currentState,
        specialPicks: upsertSpecialPick(currentState.specialPicks, nextSpecialPick),
      };
    });
  }

  function persistSpecialPick() {
    if (!effectiveSelectedUserId) {
      setSpecialPickError("Selecione um participante antes de salvar os palpites especiais.");
      setSpecialPickFeedback("");
      return;
    }

    if (specialPickAvailability.status !== "open") {
      setSpecialPickError("A janela para campeao e artilheiro ja foi encerrada.");
      setSpecialPickFeedback("");
      return;
    }

    const specialPick = getSpecialPick(state.specialPicks, effectiveSelectedUserId);

    if (!specialPick) {
      setSpecialPickError("Preencha campeao e artilheiro antes de salvar.");
      setSpecialPickFeedback("");
      return;
    }

    setSpecialPickFeedback("");
    setSpecialPickError("");

    startSavingSpecialPick(async () => {
      try {
        const response = await saveAppSpecialPickAction({
          userId: effectiveSelectedUserId,
          champion: specialPick.champion,
          topScorer: specialPick.topScorer,
        });

        setState((currentState) => ({
          ...currentState,
          specialPicks: upsertSpecialPick(
            currentState.specialPicks,
            response.specialPick,
          ),
        }));
        setSpecialPickFeedback("Campeao e artilheiro salvos no banco com sucesso.");
      } catch (error) {
        setSpecialPickError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar campeao e artilheiro.",
        );
      }
    });
  }

  function handleResultChange(
    gameId: string,
    side: "homeScore" | "awayScore",
    value: string,
  ) {
    if (confirmingOfficialGameId === gameId) {
      setConfirmingOfficialGameId(null);
    }

    setState((currentState) => {
      const existingResult =
        currentState.results.find((result) => result.gameId === gameId) ?? null;

      const nextResult: MatchResult = {
        gameId,
        homeScore:
          side === "homeScore"
            ? parseScoreInput(value)
            : existingResult?.homeScore ?? null,
        awayScore:
          side === "awayScore"
            ? parseScoreInput(value)
            : existingResult?.awayScore ?? null,
        finished: existingResult?.finished ?? false,
      };

      return {
        ...currentState,
        results: upsertResult(currentState.results, nextResult),
      };
    });
  }

  function handleResultFinished(gameId: string, finished: boolean) {
    if (confirmingOfficialGameId === gameId) {
      setConfirmingOfficialGameId(null);
    }

    setState((currentState) => {
      const existingResult =
        currentState.results.find((result) => result.gameId === gameId) ?? null;

      const nextResult: MatchResult = {
        gameId,
        homeScore: existingResult?.homeScore ?? null,
        awayScore: existingResult?.awayScore ?? null,
        finished,
      };

      return {
        ...currentState,
        results: upsertResult(currentState.results, nextResult),
      };
    });
  }

  function persistOfficialResult(gameId: string) {
    const result = state.results.find((item) => item.gameId === gameId);

    if (!result) {
      setAdminResultError("Resultado nao encontrado para salvar.");
      setAdminResultFeedback("");
      return;
    }

    setSavingOfficialGameId(gameId);
    setConfirmingOfficialGameId(null);
    setAdminResultError("");
    setAdminResultFeedback("");

    startSavingOfficialResult(async () => {
      try {
        const response = await saveOfficialAppResultAction({
          gameId,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          finished: result.finished,
        });

        setState((currentState) => ({
          ...currentState,
          results: upsertResult(currentState.results, response.result),
        }));
        setAdminResultFeedback(`Resultado do jogo ${gameId} salvo no banco.`);
      } catch (error) {
        setAdminResultError(
          error instanceof Error ? error.message : "Nao foi possivel salvar o resultado.",
        );
      } finally {
        setSavingOfficialGameId(null);
      }
    });
  }

  function openCreateParticipantCard() {
    setParticipantFormError("");
    setParticipantFormSuccess("");
    setNewParticipantName("");
    setIsCreateParticipantOpen(true);
  }

  function closeCreateParticipantCard() {
    setIsCreateParticipantOpen(false);
    setParticipantFormError("");
    setParticipantFormSuccess("");
    setNewParticipantName("");
  }

  function handleCreateParticipant() {
    const normalizedName = normalizeParticipantName(newParticipantName);

    if (!normalizedName) {
      setParticipantFormError("Informe o nome do participante.");
      return;
    }

    const duplicatedParticipant = participantList.some(
      (participant) =>
        participant.name.localeCompare(normalizedName, "pt-BR", {
          sensitivity: "accent",
        }) === 0,
    );

    if (duplicatedParticipant) {
      setParticipantFormError("Esse participante ja esta cadastrado.");
      return;
    }

    const nextParticipant: Participant = {
      id: createParticipantId(normalizedName, participantList),
      name: normalizedName,
      role: resolveParticipantRole(normalizedName),
      accentColor:
        participantAccentPalette[participantList.length % participantAccentPalette.length],
    };

    setParticipantList((currentParticipants) => [...currentParticipants, nextParticipant]);
    setSelectedUserId(nextParticipant.id);
    setParticipantFormError("");
    setParticipantFormSuccess(`${normalizedName} foi adicionado ao bolao.`);
    setNewParticipantName("");

    startSavingParticipant(async () => {
      try {
        await seedUsersIfMissingAction([normalizedName]);
      } catch {
        // Mantem o cadastro local ativo mesmo se a persistencia remota falhar.
      }
    });

    setTimeout(() => {
      setIsCreateParticipantOpen(false);
      setParticipantFormSuccess("");
      router.push("/palpites");
    }, 500);
  }

  function handleLogin(participantId: string) {
    const participant = participantList.find((item) => item.id === participantId);

    if (!participant) {
      return;
    }

    setUserRoleError("");
    setUserRoleFeedback("");
    setPrivilegedAccessError("");

    if (isPrivilegedRole(participant.role) && !verifiedPrivilegedAccess[participant.id]) {
      setPendingPrivilegedParticipantId(participant.id);
      setPrivilegedPassword("");
      return;
    }

    setPendingPrivilegedParticipantId(null);
    setUserRoleError("");
    setUserRoleFeedback("");
    router.push("/");
    setSelectedUserId(participantId);
  }

  function cancelPrivilegedLogin() {
    setPendingPrivilegedParticipantId(null);
    setPrivilegedPassword("");
    setPrivilegedAccessError("");
  }

  function submitPrivilegedLogin() {
    if (!pendingPrivilegedParticipant || !isPrivilegedRole(pendingPrivilegedParticipant.role)) {
      return;
    }

    const privilegedRole = pendingPrivilegedParticipant.role;
    setPrivilegedAccessError("");

    startVerifyingPrivilegedAccess(async () => {
      try {
        const response = await verifyPrivilegedAccessAction({
          role: privilegedRole,
          password: privilegedPassword,
        });

        if (!response.ok) {
          setPrivilegedAccessError(response.error);
          return;
        }

        setVerifiedPrivilegedAccess((currentAccess) => ({
          ...currentAccess,
          [pendingPrivilegedParticipant.id]: true,
        }));
        setSelectedUserId(pendingPrivilegedParticipant.id);
        setPendingPrivilegedParticipantId(null);
        setPrivilegedPassword("");
        router.push("/");
      } catch (error) {
        setPrivilegedAccessError(
          error instanceof Error
            ? "Nao foi possivel validar a senha agora. Tente novamente."
            : "Nao foi possivel validar a senha deste perfil.",
        );
      }
    });
  }

  function handleLogout() {
    if (selectedParticipant && isPrivilegedRole(selectedParticipant.role)) {
      setVerifiedPrivilegedAccess((currentAccess) => {
        const nextAccess = { ...currentAccess };
        delete nextAccess[selectedParticipant.id];
        return nextAccess;
      });
    }

    setSelectedUserId(null);
    setPendingPrivilegedParticipantId(null);
    setPrivilegedPassword("");
    setPrivilegedAccessError("");
    setConfirmingPredictionGameId(null);
    setPredictionFeedbackGameId(null);
    setPredictionFeedback("");
    setPredictionErrorGameId(null);
    setPredictionError("");
    router.push("/acesso");
  }

  function handleUserRoleDraftChange(participantId: string, role: AppUserRole) {
    setRoleDraftOverrides((currentDrafts) => ({
      ...currentDrafts,
      [participantId]: role,
    }));
    setUserRoleError("");
    setUserRoleFeedback("");
  }

  function persistUserRole(participantId: string) {
    const participant = participantList.find((item) => item.id === participantId);

    if (!participant) {
      setUserRoleError("Usuario nao encontrado para atualizar o acesso.");
      setUserRoleFeedback("");
      return;
    }

    const nextRole =
      participant.name.trim().toLowerCase() === "bruno"
        ? "admin"
        : (roleDrafts[participantId] ?? participant.role);

    setSavingRoleUserId(participantId);
    setUserRoleError("");
    setUserRoleFeedback("");

    startSavingUserRole(async () => {
      try {
        const response = await updateUserRoleAction({
          name: participant.name,
          role: nextRole,
        });

        if (!response.ok || !response.user) {
          setUserRoleError(response.error || "Nao foi possivel atualizar o papel do usuario.");
          setUserRoleFeedback("");
          return;
        }

        setParticipantList((currentParticipants) =>
          currentParticipants.map((currentParticipant) =>
            currentParticipant.id === participantId
              ? {
                  ...currentParticipant,
                  role: resolveParticipantRole(
                    currentParticipant.name,
                    response.user.role,
                  ),
                }
              : currentParticipant,
          ),
        );
        setRoleDraftOverrides((currentDrafts) => ({
          ...currentDrafts,
          [participantId]: resolveParticipantRole(participant.name, response.user.role),
        }));
        setUserRoleFeedback(`${participant.name} agora esta como ${getRoleLabel(nextRole)}.`);
      } catch (error) {
        setUserRoleError(
          error instanceof Error
            ? "Nao foi possivel atualizar o papel do usuario agora. Tente novamente."
            : "Nao foi possivel atualizar o papel do usuario.",
        );
      } finally {
        setSavingRoleUserId(null);
      }
    });
  }

  function resetDemoData() {
    setState({
      ...initialState,
      predictions: mergeInitialPredictions(initialAppPredictions),
      specialPicks: mergeInitialSpecialPicks(initialAppSpecialPicks),
      results: mergeInitialResults(initialOfficialResults),
    });
    setParticipantList(mergeParticipants(participants, initialRemoteUsers));
    setSelectedUserId(null);
    setVerifiedPrivilegedAccess({});
    setPendingPrivilegedParticipantId(null);
    setPrivilegedPassword("");
    setPrivilegedAccessError("");
    setIsCreateParticipantOpen(false);
    setParticipantFormError("");
    setParticipantFormSuccess("");
    setNewParticipantName("");
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_PARTICIPANTS_KEY);
      window.localStorage.removeItem(LOCAL_STORAGE_STATE_KEY);
      window.localStorage.removeItem(LOCAL_STORAGE_SELECTED_USER_KEY);
    } catch {
      // Mantem o reset funcional mesmo sem acesso ao storage.
    }
    router.push("/");
  }

  const requiresAuthenticatedPage =
    currentPage === "palpites" ||
    currentPage === "ranking" ||
    currentPage === "admin";
  const isAdminPageBlocked = currentPage === "admin" && isLoggedIn && !canAccessAdmin;
  const selectedSpecialPick = effectiveSelectedUserId
    ? getSpecialPick(state.specialPicks, effectiveSelectedUserId)
    : undefined;

  return (
    <main className="min-h-screen bg-bolao-bg text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-4 sm:py-5 md:gap-6 md:px-6 md:py-8">
        <BolaoNav
          isLoggedIn={isLoggedIn}
          currentUserRole={currentUserRole}
        />

        <section className="glass-surface rounded-2xl p-4 md:rounded-3xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-3 text-emerald-300">
                {currentPageInfo.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{currentPageInfo.label}</p>
                <p className="text-sm text-slate-400">{currentPageInfo.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Atualizado em {formatFullDateTime(now.toISOString())}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                {selectedParticipant ? (
                  <>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white">
                      {selectedParticipant.name}
                    </span>
                    <RoleBadge role={selectedParticipant.role} />
                  </>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                    Nenhum usuario logado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/acesso")}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  {isLoggedIn ? "Trocar usuario" : "Entrar"}
                </button>
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-400/15"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {!isLoggedIn && requiresAuthenticatedPage ? (
            <motion.div key="protected-login" {...tabTransition}>
              <AccessStateCard
                title="Login necessario"
                description="Escolha um participante na tela de acesso para liberar palpites, ranking e administracao."
                actionHref="/acesso"
                actionLabel="Ir para acesso"
              />
            </motion.div>
          ) : isAdminPageBlocked ? (
            <motion.div key="protected-role" {...tabTransition}>
              <AccessStateCard
                title="Acesso restrito"
                description="A pagina de admin fica liberada apenas para admin e moderador. Usuarios comuns continuam com acesso a palpites e ranking."
                actionHref="/"
                actionLabel="Voltar ao dashboard"
              />
            </motion.div>
          ) : currentPage === "menu" ? (
            <motion.div key="page-menu" {...tabTransition}>
              <div className="space-y-6">
                <SectionCard
                  title="Dashboard"
                  subtitle="Proximos jogos e panorama rapido do bolao"
                  icon={<Trophy className="h-6 w-6" />}
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                      label="Participantes"
                      value={String(participantList.length)}
                      helper="Usuarios cadastrados no bolao"
                    />
                    <StatCard
                      label="Proximos jogos"
                      value={String(upcomingGames.length)}
                      helper="Partidas mais proximas do calendario"
                    />
                    <StatCard
                      label="Jogos finalizados"
                      value={String(finishedGamesCount)}
                      helper="Resultados oficiais ja inseridos"
                    />
                    <StatCard
                      label="Acumulado atual"
                      value={formatCurrency(
                        currentRollover.result + currentRollover.goals + currentRollover.exact,
                      )}
                      helper="Soma dos potes acumulados no momento"
                    />
                  </div>
                </SectionCard>

                <DailyGuessesCard
                  dayLabel={dailyGuesses.dayLabel}
                  games={dailyGuesses.games}
                  participants={participantList}
                  predictions={state.predictions}
                  results={state.results}
                />

                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <SectionCard
                    title="Agenda"
                    subtitle="Lista curta com os proximos confrontos"
                    icon={<CalendarDays className="h-6 w-6" />}
                  >
                    <div className="space-y-3">
                      {upcomingGames.length ? (
                        upcomingGames.map((game) => (
                          <DashboardGameRow
                            key={game.id}
                            game={game}
                            result={state.results.find((item) => item.gameId === game.id)}
                          />
                        ))
                      ) : (
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                          Nenhum proximo jogo encontrado no calendario.
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Resumo"
                    subtitle="Informacoes uteis para acompanhar o andamento"
                    icon={<Medal className="h-6 w-6" />}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <StatCard
                        label="Palpites salvos"
                        value={String(predictionsCount)}
                        helper="Palpites persistidos para os jogos"
                      />
                      <StatCard
                        label="Lider em cravos"
                        value={
                          exactLeaders.length
                            ? exactLeaders.map((entry) => entry.name).join(", ")
                            : "Sem lider"
                        }
                        helper="Atualizado conforme resultados oficiais"
                      />
                      <StatCard
                        label="Pendentes"
                        value={isLoggedIn ? String(pendingPredictionsCount) : "-"}
                        helper={
                          isLoggedIn
                            ? "Jogos abertos sem palpite completo"
                            : "Faca login para ver seus pendentes"
                        }
                      />
                      <StatCard
                        label="Investimento"
                        value={formatCurrency(TOURNAMENT_INVESTMENT_TOTAL)}
                        helper="Acerto final por participante"
                      />
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                      {selectedParticipant ? (
                        <>
                          <p>
                            Usuario ativo:{" "}
                            <span className="font-semibold text-white">
                              {selectedParticipant.name}
                            </span>
                          </p>
                          <p className="mt-2">
                            Perfil atual:{" "}
                            <span className="font-semibold text-white">
                              {getRoleLabel(selectedParticipant.role)}
                            </span>
                            .
                            {selectedParticipant.role === "user"
                              ? " Acesso a palpites e ranking."
                              : selectedParticipant.role === "moderator"
                                ? " Acesso a palpites, ranking e admin."
                                : " Acesso completo ao admin e ao controle de usuarios."}
                          </p>
                        </>
                      ) : (
                        <p>
                          Faca login em{" "}
                          <span className="font-semibold text-white">Acesso</span> para
                          liberar palpites, ranking e administracao conforme o seu perfil.
                        </p>
                      )}
                    </div>
                  </SectionCard>
                </div>
              </div>
            </motion.div>
          ) : currentPage === "acesso" ? (
            <motion.div key="tab-acesso" {...tabTransition}>
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <SectionCard
                  title="Login"
                  subtitle="Escolha o participante para entrar no sistema"
                  icon={<UserCircle2 className="h-6 w-6" />}
                >
                  {selectedParticipant && (
                    <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">
                            Sessao ativa com {selectedParticipant.name}
                          </p>
                          <p className="mt-1 text-emerald-100/80">
                            Troque de usuario quando quiser ou saia para bloquear o acesso local.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <RoleBadge role={selectedParticipant.role} />
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-400/15"
                          >
                            Sair
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {participantList.map((participant) => {
                      const isActive = participant.id === effectiveSelectedUserId;
                      const requiresPassword = isPrivilegedRole(participant.role);

                      return (
                        <button
                          key={participant.id}
                          type="button"
                          onClick={() => handleLogin(participant.id)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            isActive
                              ? "border-white/40 bg-white/10"
                              : "border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/5"
                          }`}
                          style={{
                            boxShadow: isActive
                              ? `0 0 0 1px ${participant.accentColor}, inset 0 0 25px rgba(255,255,255,0.03)`
                              : undefined,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white"
                              style={{ backgroundColor: participant.accentColor }}
                            >
                              {participant.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-white">{participant.name}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {isActive
                                  ? "Usuario ativo"
                                  : requiresPassword
                                    ? "Senha obrigatoria"
                                    : "Entrar no sistema"}
                              </p>
                              <div className="mt-3">
                                <RoleBadge role={participant.role} />
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {pendingPrivilegedParticipant && (
                    <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
                      <p className="font-medium text-white">
                        Acesso protegido para {pendingPrivilegedParticipant.name}
                      </p>
                      <p className="mt-2 text-amber-100/90">
                        Digite a senha de {getRoleLabel(pendingPrivilegedParticipant.role)} para
                        liberar o acesso a este perfil.
                      </p>

                      <input
                        type="password"
                        autoFocus
                        value={privilegedPassword}
                        onChange={(event) => setPrivilegedPassword(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            submitPrivilegedLogin();
                          }
                        }}
                        placeholder="Digite a senha"
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-amber-300/60"
                      />

                      {privilegedAccessError && (
                        <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-100">
                          {privilegedAccessError}
                        </div>
                      )}

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={submitPrivilegedLogin}
                          disabled={isVerifyingPrivilegedAccess}
                          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/15 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isVerifyingPrivilegedAccess ? "Validando..." : "Entrar com senha"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelPrivilegedLogin}
                          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                    Usuarios comuns entram apenas selecionando o nome. Perfis de admin e
                    moderador pedem senha para evitar que qualquer pessoa mexa no sistema.
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={openCreateParticipantCard}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar participante
                    </button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Regras"
                  subtitle="Perfis, premios e janela de edicao"
                  icon={<ShieldCheck className="h-6 w-6" />}
                >
                  <div className="grid gap-3">
                    {scoringRules.map((rule) => (
                      <div
                        key={rule.label}
                        className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                      >
                        <span className="text-sm text-slate-300">{rule.label}</span>
                        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                          {formatCurrency(rule.value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">Perfis de acesso</p>
                    <p className="mt-2">Admin: controla usuarios e resultados oficiais.</p>
                    <p className="mt-1">Moderador: atualiza resultados na pagina de admin.</p>
                    <p className="mt-1">Usuario: acessa apenas dashboard, palpites e ranking.</p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4 text-sm text-amber-100/90">
                    Cada jogo forma 3 potes: resultado, gols e placar exato. Se ninguem
                    acertar um criterio, o valor acumula para o proximo jogo. Os palpites
                    podem ser editados ate 1 minuto antes do apito inicial.
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-sm text-emerald-100/90">
                    Investimento total por participante:{" "}
                    <span className="font-semibold text-white">
                      {formatCurrency(TOURNAMENT_INVESTMENT_TOTAL)}
                    </span>
                    . O encontro de contas acontece no fim com a formula ganhos menos
                    investimento total.
                  </div>

                  <div className="mt-4 grid gap-3">
                    {awardRules.map((award) => (
                      <div
                        key={award.label}
                        className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                      >
                        <p className="text-sm font-medium text-white">{award.label}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Pote final atual:{" "}
                          {formatCurrency(participantList.length * award.prize)}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </motion.div>
          ) : currentPage === "palpites" ? (
            <motion.div key="tab-palpites" {...tabTransition}>
              <SectionCard
                title="Palpites"
                subtitle="Lista ordenada pela data de cada jogo"
                icon={<Swords className="h-6 w-6" />}
              >
                <div className="mb-6 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Usuario
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {selectedParticipant?.name}
                    </p>
                    <p className="mt-1">
                      Os palpites ficam abertos ate 1 minuto antes de cada jogo.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Jogos abertos
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {openPredictionsCount}
                    </p>
                    <p className="mt-1">
                      Partidas com janela de palpite ainda aberta.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Pendentes
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {pendingPredictionsCount}
                    </p>
                    <p className="mt-1">
                      Jogos abertos sem placar completo salvo.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {predictionGamesByDate.map((group) => (
                    <div key={group.dayKey} className="space-y-4">
                      <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                        <p className="text-sm font-semibold text-white">{group.label}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {group.games.length}{" "}
                          {group.games.length === 1 ? "jogo" : "jogos"}
                        </p>
                      </div>
                      {group.games.map((game) => (
                        <PredictionGameCard
                          key={game.id}
                          game={game}
                          selectedUserId={effectiveSelectedUserId}
                          selectedParticipant={selectedParticipant}
                          predictions={state.predictions}
                          results={state.results}
                          breakdown={financeSummary.matchBreakdowns[game.id]}
                          now={now}
                          onPredictionChange={handlePredictionChange}
                          onSaveRequest={requestPredictionSave}
                          onSaveConfirm={persistPrediction}
                          isSaving={isSavingPrediction && savingPredictionGameId === game.id}
                          isConfirming={confirmingPredictionGameId === game.id}
                          feedbackMessage={
                            predictionFeedbackGameId === game.id ? predictionFeedback : ""
                          }
                          errorMessage={
                            predictionErrorGameId === game.id ? predictionError : ""
                          }
                        />
                      ))}
                    </div>
                  ))}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-amber-300" />
                        <h3 className="text-lg font-semibold text-white">Campeao da Copa</h3>
                      </div>
                      <input
                        type="text"
                        disabled={!selectedParticipant || specialPickAvailability.status !== "open"}
                        value={selectedSpecialPick?.champion ?? ""}
                        onChange={(event) =>
                          handleSpecialPickChange("champion", event.target.value)
                        }
                        placeholder="Ex.: Brasil"
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <p className="mt-3 text-xs text-slate-400">
                        {specialPickAvailability.message}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center gap-3">
                        <Goal className="h-5 w-5 text-sky-300" />
                        <h3 className="text-lg font-semibold text-white">Artilheiro da Copa</h3>
                      </div>
                      <input
                        type="text"
                        disabled={!selectedParticipant || specialPickAvailability.status !== "open"}
                        value={selectedSpecialPick?.topScorer ?? ""}
                        onChange={(event) =>
                          handleSpecialPickChange("topScorer", event.target.value)
                        }
                        placeholder="Ex.: Mbappe"
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-sky-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <p className="mt-3 text-xs text-slate-400">
                        {specialPickAvailability.message}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-300">
                        Campeao e artilheiro tambem ficam persistidos no banco.
                      </p>
                      <button
                        type="button"
                        onClick={persistSpecialPick}
                        disabled={!selectedParticipant || isSavingSpecialPick || specialPickAvailability.status !== "open"}
                        className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingSpecialPick ? "Salvando..." : "Salvar campeao e artilheiro"}
                      </button>
                    </div>

                    {specialPickFeedback && (
                      <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                        {specialPickFeedback}
                      </div>
                    )}

                    {specialPickError && (
                      <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-100">
                        {specialPickError}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            </motion.div>
          ) : currentPage === "ranking" ? (
            <motion.div key="tab-ranking" {...tabTransition}>
              <div className="space-y-6">
                <SectionCard
                  title="Leaderboard"
                  subtitle="Ganhos acumulados, premios finais e acerto de contas"
                  icon={<Medal className="h-6 w-6" />}
                >
                  <div className="grid gap-4 lg:grid-cols-4">
                    <div className="rounded-3xl border border-amber-300/15 bg-amber-300/5 p-4">
                      <p className="text-sm text-amber-100/80">Lider em cravos</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {exactLeaders.length
                          ? exactLeaders.map((entry) => entry.name).join(", ")
                          : "Sem lider ainda"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Pote final: {formatCurrency(financeSummary.finalAwards.exactHitsPot)}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/5 p-4">
                      <p className="text-sm text-emerald-100/80">Acertou o campeao</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {championWinners.length
                          ? championWinners.map((entry) => entry.name).join(", ")
                          : "Aguardando definicao oficial"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Pote final: {formatCurrency(financeSummary.finalAwards.championPot)}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-sky-300/15 bg-sky-300/5 p-4">
                      <p className="text-sm text-sky-100/80">Acertou o artilheiro</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {topScorerWinners.length
                          ? topScorerWinners.map((entry) => entry.name).join(", ")
                          : "Aguardando definicao oficial"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Pote final: {formatCurrency(financeSummary.finalAwards.topScorerPot)}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-fuchsia-300/15 bg-fuchsia-300/5 p-4">
                      <div className="flex items-center gap-2 text-fuchsia-100/80">
                        <RotateCcw className="h-4 w-4" />
                        <p className="text-sm">Acumulado Atual</p>
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        <p>
                          Resultado:{" "}
                          <span className="font-semibold text-white">
                            {formatCurrency(currentRollover.result)}
                          </span>
                        </p>
                        <p>
                          Gols:{" "}
                          <span className="font-semibold text-white">
                            {formatCurrency(currentRollover.goals)}
                          </span>
                        </p>
                        <p>
                          Placar Exato:{" "}
                          <span className="font-semibold text-white">
                            {formatCurrency(currentRollover.exact)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <RankingTable ranking={ranking} />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Grupos"
                  subtitle="Tabelas dinamicas com criterios FIFA: pontos, saldo e gols pro"
                  icon={<Table2 className="h-6 w-6" />}
                >
                  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                    {groupsData.map((group) => (
                      <div
                        key={group.id}
                        className="min-w-0 space-y-3 rounded-3xl border border-white/8 bg-black/20 p-4"
                      >
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                            3o lugar atual: {standingsByGroup[group.id][2]?.team.shortName ?? "-"}
                          </span>
                        </div>
                        <StandingsTable standings={standingsByGroup[group.id]} />
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 min-w-0 rounded-3xl border border-white/8 bg-black/20 p-4">
                    <h3 className="text-lg font-semibold text-white">
                      Ranking dos terceiros colocados
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {bestThirds.map((entry) => (
                        <div
                          key={entry.teamId}
                          className="rounded-2xl border border-white/8 bg-white/5 p-3"
                        >
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                            #{entry.thirdPlaceRank} terceiro
                          </p>
                          <p className="mt-2 font-semibold text-white">
                            {entry.groupId} Â· {entry.team.shortName}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {entry.points} pts Â· SG {entry.goalDifference} Â· GP {entry.goalsFor}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Chaveamento"
                  subtitle="16 avos de final em diante preenchidos automaticamente"
                  icon={<GitBranch className="h-6 w-6" />}
                >
                  <div className="grid min-w-0 gap-4 xl:grid-cols-4">
                    {stageOrder
                      .filter((stage) => stage !== "group")
                      .map((stage) => {
                        const stageGames = knockout.games.filter((game) => game.stage === stage);

                        if (!stageGames.length) {
                          return null;
                        }

                        return (
                          <BracketColumn
                            key={stage}
                            title={stageGames[0].roundLabel}
                            games={stageGames}
                            state={state}
                          />
                        );
                      })}
                  </div>
                </SectionCard>
              </div>
            </motion.div>
          ) : currentPage === "admin" ? (
            <motion.div key="tab-admin" {...tabTransition}>
              <div className="space-y-6">
                {canManageUsers && (
                  <SectionCard
                    title="Controle"
                    subtitle="Defina quem e moderador e quem permanece como usuario"
                    icon={<UserCircle2 className="h-6 w-6" />}
                  >
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                      Esta area fica disponivel somente para o admin. Use o botao abaixo para
                      ir direto ao controle de usuarios.
                    </div>
                    <a
                      href="#controle-usuarios"
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                    >
                      Abrir controle de usuarios
                    </a>
                  </SectionCard>
                )}

                <SectionCard
                  title="Administracao"
                  subtitle="Lista ordenada pela data de cada jogo"
                  icon={<ShieldCheck className="h-6 w-6" />}
                >
                  <div className="mb-6 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Perfil
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {currentUserRole === "moderator" ? "Moderador" : "Admin"}
                      </p>
                      <p className="mt-1">
                        Atualize os resultados oficiais em ordem cronologica.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Encerrados
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {finishedOfficialResultsCount}
                      </p>
                      <p className="mt-1">Jogos marcados como encerrados no painel.</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Pendentes
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {pendingOfficialResultsCount}
                      </p>
                      <p className="mt-1">Partidas ainda sem resultado oficial encerrado.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100/90">
                    {currentUserRole === "moderator"
                      ? "Voce esta como moderador e pode atualizar resultados oficiais."
                      : "Como admin, voce pode atualizar resultados oficiais e controlar os papeis dos usuarios."}
                  </div>

                  {adminResultFeedback && (
                    <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                      {adminResultFeedback}
                    </div>
                  )}

                  {adminResultError && (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                      {adminResultError}
                    </div>
                  )}

                  <div className="mt-6 space-y-6">
                    {officialGamesByDate.map((group) => (
                      <div key={group.dayKey} className="space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                          <p className="text-sm font-semibold text-white">{group.label}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {group.games.length} {group.games.length === 1 ? "jogo" : "jogos"}
                          </p>
                        </div>
                        {group.games.map((game) => (
                          <AdminResultGameCard
                            key={game.id}
                            game={game}
                            result={state.results.find((item) => item.gameId === game.id)}
                            onResultChange={handleResultChange}
                            onResultFinished={handleResultFinished}
                            onSaveRequest={(gameId) => {
                              setConfirmingOfficialGameId(gameId || null);
                              setAdminResultError("");
                              setAdminResultFeedback("");
                            }}
                            onSaveConfirm={persistOfficialResult}
                            isSaving={
                              isSavingOfficialResult && savingOfficialGameId === game.id
                            }
                            isConfirming={confirmingOfficialGameId === game.id}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-amber-300" />
                        <h3 className="text-lg font-semibold text-white">Oficial da Copa</h3>
                      </div>
                      <label className="mt-4 block">
                        <span className="text-sm text-slate-400">Campeao oficial</span>
                        <input
                          type="text"
                          value={state.awards.champion ?? ""}
                          onChange={(event) =>
                            setState((currentState) => ({
                              ...currentState,
                              awards: {
                                ...currentState.awards,
                                champion: event.target.value || null,
                              },
                            }))
                          }
                          placeholder="Ex.: Brasil"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-amber-300/60"
                        />
                      </label>

                      <label className="mt-4 block">
                        <span className="text-sm text-slate-400">Artilheiro oficial</span>
                        <input
                          type="text"
                          value={state.awards.topScorer ?? ""}
                          onChange={(event) =>
                            setState((currentState) => ({
                              ...currentState,
                              awards: {
                                ...currentState.awards,
                                topScorer: event.target.value || null,
                              },
                            }))
                          }
                          placeholder="Ex.: Mbappe"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                        />
                      </label>
                    </div>

                    <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                      <p className="text-sm font-semibold text-white">Acoes da demo</p>
                      <button
                        type="button"
                        onClick={resetDemoData}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restaurar massa inicial
                      </button>
                    </div>
                  </div>
                </SectionCard>

                {canManageUsers && (
                  <div id="controle-usuarios">
                    <SectionCard
                      title="Usuarios"
                      subtitle="Controle quem e moderador e quem e usuario comum"
                      icon={<UserCircle2 className="h-6 w-6" />}
                    >
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                      Bruno permanece como admin fixo. Moderadores podem usar a pagina de admin para lancar resultados oficiais.
                    </div>

                    {userRoleFeedback && (
                      <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                        {userRoleFeedback}
                      </div>
                    )}

                    {userRoleError && (
                      <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                        {userRoleError}
                      </div>
                    )}

                    <div className="mt-6 space-y-3">
                      {[...participantList]
                        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
                        .map((participant) => {
                          const isFixedAdmin =
                            participant.name.trim().toLowerCase() === "bruno";
                          const draftRole = isFixedAdmin
                            ? "admin"
                            : (roleDrafts[participant.id] ?? participant.role);

                          return (
                            <div
                              key={participant.id}
                              className="rounded-2xl border border-white/8 bg-black/20 p-4"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                  <p className="font-semibold text-white">{participant.name}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <RoleBadge role={participant.role} />
                                    {selectedUserId === participant.id && (
                                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                                        Usuario ativo
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                  <select
                                    value={draftRole}
                                    disabled={isFixedAdmin || (isSavingUserRole && savingRoleUserId === participant.id)}
                                    onChange={(event) =>
                                      handleUserRoleDraftChange(
                                        participant.id,
                                        event.target.value as AppUserRole,
                                      )
                                    }
                                    className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <option value="user">Usuario</option>
                                    <option value="moderator">Moderador</option>
                                  </select>

                                  {isFixedAdmin ? (
                                    <span className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
                                      Admin fixo
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => persistUserRole(participant.id)}
                                      disabled={isSavingUserRole && savingRoleUserId === participant.id}
                                      className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isSavingUserRole && savingRoleUserId === participant.id
                                        ? "Salvando..."
                                        : "Salvar papel"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    </SectionCard>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {isCreateParticipantOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="glass-surface w-full max-w-md rounded-3xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
                      Novo Participante
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      Cadastro rapido para entrar no bolao
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeCreateParticipantCard}
                    className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 active:scale-95"
                    aria-label="Fechar cadastro"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-sm text-slate-300">Nome do participante</span>
                    <input
                      type="text"
                      autoFocus
                      value={newParticipantName}
                      onChange={(event) => {
                        setNewParticipantName(event.target.value);
                        if (participantFormError) {
                          setParticipantFormError("");
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleCreateParticipant();
                        }
                      }}
                      placeholder="Ex.: Marcelo"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60"
                    />
                  </label>

                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
                    Ao salvar, o novo participante entra imediatamente no acesso, no ranking e no fluxo completo de palpites.
                  </div>

                  {participantFormError && (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                      {participantFormError}
                    </div>
                  )}

                  {participantFormSuccess && (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                      {participantFormSuccess}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={closeCreateParticipantCard}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10 active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateParticipant}
                      disabled={isSavingParticipant}
                      className="flex-1 rounded-2xl border border-emerald-400/20 bg-emerald-400/15 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingParticipant ? "Salvando..." : "Salvar participante"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
