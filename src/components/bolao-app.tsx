"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Crown,
  GitBranch,
  Goal,
  Lock,
  LogIn,
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
  saveOfficialAppResultAction,
  seedUsersIfMissingAction,
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
  groupGamesByStage,
  scoringRules,
  upsertPrediction,
  upsertResult,
} from "@/lib/bolao";
import {
  calculateAllStandings,
  calculateTournamentFinance,
  generateKnockoutBracket,
  rankThirdPlacedTeams,
  TOURNAMENT_INVESTMENT_TOTAL,
} from "@/lib/tournamentEngine";
import type {
  AppState,
  GroupId,
  MatchPoolBreakdown,
  MatchResult,
  Participant,
  Prediction,
  RankingEntry,
  ResolvedGame,
  StandingEntry,
  Team,
} from "@/types/bolao";

type AppPageKey = "menu" | "acesso" | "palpites" | "ranking" | "admin";
const LOCAL_STORAGE_PARTICIPANTS_KEY = "bolao-copa-2026-participants";
const LOCAL_STORAGE_STATE_KEY = "bolao-copa-2026-app-state";
const LOCAL_STORAGE_SELECTED_USER_KEY = "bolao-copa-2026-selected-user";
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
    label: "Menu",
    description: "Atalhos principais do bolao",
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

function mergeParticipants(
  existingParticipants: Participant[],
  incomingNames: string[],
) {
  const mergedParticipants = [...existingParticipants];

  for (const rawName of incomingNames) {
    const normalizedName = normalizeParticipantName(rawName);

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
      continue;
    }

    mergedParticipants.push({
      id: createParticipantId(normalizedName, mergedParticipants),
      name: normalizedName,
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

function createInitialAppState(initialOfficialResults: MatchResult[]) {
  const initialResults = mergeInitialResults(initialOfficialResults);

  if (typeof window === "undefined") {
    return {
      ...initialState,
      results: initialResults,
    };
  }

  try {
    const rawState = window.localStorage.getItem(LOCAL_STORAGE_STATE_KEY);

    if (!rawState) {
      return {
        ...initialState,
        results: initialResults,
      };
    }

    const parsedState = JSON.parse(rawState) as Partial<AppState>;

    return {
      predictions: Array.isArray(parsedState.predictions)
        ? parsedState.predictions
        : initialState.predictions,
      specialPicks: Array.isArray(parsedState.specialPicks)
        ? parsedState.specialPicks
        : initialState.specialPicks,
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
                  {formatCurrency(entry.netSettlement)} · {entry.settlementLabel}
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
}) {
  const prediction = selectedUserId
    ? getPrediction(predictions, selectedUserId, game.id)
    : undefined;
  const result = results.find((item) => item.gameId === game.id);
  const reward = getPredictionReward(prediction, result, breakdown);
  const availability = getPredictionAvailability(game, now);
  const isEditable = Boolean(selectedParticipant) && availability.status === "open";
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
              {game.matchdayLabel ? ` · ${game.matchdayLabel}` : ""}
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
          </div>
        </div>
      </div>
    </article>
  );
}

function DashboardAccordion({
  title,
  subtitle,
  games,
  pendingCount,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  games: number;
  pendingCount: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-surface rounded-3xl transition-transform duration-300 hover:scale-[1.01]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col items-start gap-3 p-4 text-left transition hover:bg-white/[0.03] active:scale-[0.99] sm:flex-row sm:items-center sm:justify-between md:p-5"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-white md:text-lg">{title}</h3>
            {!isOpen && pendingCount > 0 && (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]" />
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {games} {games === 1 ? "jogo" : "jogos"} · {subtitle}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
          {pendingCount > 0 && (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
              {pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}
            </span>
          )}
          <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {games}
          </span>
          <ChevronDown
            className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 px-4 pb-4 pt-1 md:px-5 md:pb-5">
              <div className="space-y-4 pt-4">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BolaoApp({
  currentPage,
  initialRemoteUserNames = [],
  initialOfficialResults = [],
}: {
  currentPage: AppPageKey;
  initialRemoteUserNames?: string[];
  initialOfficialResults?: MatchResult[];
}) {
  const router = useRouter();
  const [participantList, setParticipantList] = useState<Participant[]>(() => {
    const baseParticipants = mergeParticipants(participants, initialRemoteUserNames);

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
          accumulator.push(participant);
        }

        return accumulator;
      }, [...baseParticipants]);
    } catch {
      return baseParticipants;
    }
  });
  const [state, setState] = useState<AppState>(() =>
    createInitialAppState(initialOfficialResults),
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
  const [openDashboardSection, setOpenDashboardSection] = useState<string | null>(
    "group-A",
  );
  const [openAdminSection, setOpenAdminSection] = useState<string | null>(
    "admin-group-A",
  );
  const [isCreateParticipantOpen, setIsCreateParticipantOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [participantFormError, setParticipantFormError] = useState("");
  const [participantFormSuccess, setParticipantFormSuccess] = useState("");
  const [isSavingParticipant, startSavingParticipant] = useTransition();
  const [isSavingOfficialResult, startSavingOfficialResult] = useTransition();
  const [savingOfficialGameId, setSavingOfficialGameId] = useState<string | null>(null);
  const [confirmingOfficialGameId, setConfirmingOfficialGameId] = useState<string | null>(
    null,
  );
  const [adminResultFeedback, setAdminResultFeedback] = useState("");
  const [adminResultError, setAdminResultError] = useState("");

  const now = new Date();
  const selectedParticipant =
    participantList.find((participant) => participant.id === selectedUserId) ?? null;
  const effectiveSelectedUserId = selectedParticipant?.id ?? null;

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

  const groupGamesMap = useMemo(
    () =>
      Object.fromEntries(
        groupsData.map((group) => [
          group.id,
          groupResolvedGames.filter((game) => game.groupId === group.id),
        ]),
      ) as Record<GroupId, ResolvedGame[]>,
    [groupResolvedGames],
  );

  const knockoutByRound = useMemo(
    () => groupGamesByStage(knockout.games),
    [knockout.games],
  );

  function toggleDashboardSection(sectionId: string) {
    setOpenDashboardSection((currentSection) =>
      currentSection === sectionId ? null : sectionId,
    );
  }

  function toggleAdminSection(sectionId: string) {
    setOpenAdminSection((currentSection) =>
      currentSection === sectionId ? null : sectionId,
    );
  }

  function getPendingPredictionCount(games: ResolvedGame[]) {
    if (!effectiveSelectedUserId) {
      return 0;
    }

    return games.filter((game) => {
      const availability = getPredictionAvailability(game, now);
      const prediction = getPrediction(
        state.predictions,
        effectiveSelectedUserId,
        game.id,
      );

      return (
        availability.status === "open" &&
        (!prediction ||
          prediction.homeScore === null ||
          prediction.awayScore === null)
      );
    }).length;
  }

  const firstPendingDashboardSection = (() => {
    for (const group of groupsData) {
      if (getPendingPredictionCount(groupGamesMap[group.id]) > 0) {
        return `group-${group.id}`;
      }
    }

    for (const [roundLabel, games] of Object.entries(knockoutByRound)) {
      if (getPendingPredictionCount(games) > 0) {
        return `knockout-${roundLabel}`;
      }
    }

    return "group-A";
  })();

  const effectiveOpenDashboardSection =
    openDashboardSection ?? firstPendingDashboardSection;

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

  function handleSpecialPickChange(field: "champion" | "topScorer", value: string) {
    if (!effectiveSelectedUserId || specialPickAvailability.status !== "open") {
      return;
    }

    setState((currentState) => {
      const nextSpecialPicks = currentState.specialPicks.map((pick) =>
        pick.userId === effectiveSelectedUserId ? { ...pick, [field]: value } : pick,
      );

      return {
        ...currentState,
        specialPicks:
          nextSpecialPicks.some((pick) => pick.userId === effectiveSelectedUserId)
            ? nextSpecialPicks
            : [
                ...currentState.specialPicks,
                {
                  userId: effectiveSelectedUserId,
                  champion: field === "champion" ? value : "",
                  topScorer: field === "topScorer" ? value : "",
                },
              ],
      };
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

  function resetDemoData() {
    setState({
      ...initialState,
      results: mergeInitialResults(initialOfficialResults),
    });
    setParticipantList(mergeParticipants(participants, initialRemoteUserNames));
    setSelectedUserId(null);
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

  return (
    <main className="min-h-screen bg-bolao-bg text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-4 sm:py-5 md:gap-6 md:px-6 md:py-8">
        {currentPage === "menu" && (
          <header className="glass-surface overflow-hidden rounded-[1.5rem] p-4 md:rounded-[2rem] md:p-8">
            <div className="grid gap-4 md:gap-6 lg:grid-cols-[1.3fr_0.9fr]">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200 md:mb-4 md:text-xs md:tracking-[0.28em]">
                  <Trophy className="h-4 w-4" />
                  Bolao Copa 2026
                </div>
                <h1 className="max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl md:text-5xl">
                  Bolao da Copa com potes compartilhados, rollover e acerto final.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:mt-4 md:text-base md:leading-7">
                  O sistema agora considera 48 selecoes, 12 grupos, classificacao
                  automatica, 8 melhores terceiros colocados, chaveamento do
                  mata-mata, potes pari-mutuel por criterio e trava de palpites ate
                  1 minuto antes do jogo.
                </p>
                <div className="mt-3 rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 px-4 py-3 text-xs text-slate-300 sm:text-sm">
                  Agora: <span className="font-semibold text-white">{formatFullDateTime(now.toISOString())}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Participantes"
                  value={String(participantList.length)}
                  helper="Grupo fechado para o bolao"
                />
                <StatCard
                  label="Jogos cadastrados"
                  value={String(gamesData.length)}
                  helper="72 de grupos + 32 de mata-mata"
                />
                <StatCard
                  label="Palpites salvos"
                  value={String(predictionsCount)}
                  helper="Base inicial pronta para testes"
                />
                <StatCard
                  label="Jogos finalizados"
                  value={String(finishedGamesCount)}
                  helper="Resultados oficiais inseridos pelo admin"
                />
              </div>
            </div>
          </header>
        )}

        <BolaoNav />

        <section className="glass-surface rounded-2xl p-4 md:rounded-3xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-3 text-emerald-300">
                {currentPageInfo.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{currentPageInfo.label}</p>
                <p className="text-sm text-slate-400">{currentPageInfo.description}</p>
              </div>
            </div>

            <div className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 sm:w-auto">
              {selectedParticipant
                ? `Usuario ativo: ${selectedParticipant.name}`
                : "Nenhum usuario selecionado"}
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
        {currentPage === "menu" && (
          <motion.div key="page-menu" {...tabTransition}>
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <SectionCard
                title="Menu Principal"
                subtitle="Escolha a area que deseja acessar no bolao"
                icon={<Trophy className="h-6 w-6" />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/acesso"
                    className="rounded-2xl border border-white/8 bg-black/20 p-3.5 transition hover:border-white/20 hover:bg-white/5 md:p-4"
                  >
                    <p className="font-semibold text-white">Acesso</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Selecionar participante, cadastrar novo nome e revisar as regras.
                    </p>
                  </Link>
                  <Link
                    href="/palpites"
                    className="rounded-2xl border border-white/8 bg-black/20 p-3.5 transition hover:border-white/20 hover:bg-white/5 md:p-4"
                  >
                    <p className="font-semibold text-white">Palpites</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Preencher jogos, campeao e artilheiro com foco total no mobile.
                    </p>
                  </Link>
                  <Link
                    href="/ranking"
                    className="rounded-2xl border border-white/8 bg-black/20 p-3.5 transition hover:border-white/20 hover:bg-white/5 md:p-4"
                  >
                    <p className="font-semibold text-white">Ranking</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Ver ganhos, acerto de contas, grupos e chaveamento.
                    </p>
                  </Link>
                  <Link
                    href="/admin"
                    className="rounded-2xl border border-white/8 bg-black/20 p-3.5 transition hover:border-white/20 hover:bg-white/5 md:p-4"
                  >
                    <p className="font-semibold text-white">Admin</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Salvar resultados oficiais com confirmacao antes de gravar.
                    </p>
                  </Link>
                </div>

                <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-sm text-emerald-100/90">
                  Navegue por paginas dedicadas para reduzir o comprimento da tela no
                  celular e deixar cada area mais direta.
                </div>
              </SectionCard>

              <SectionCard
                title="Resumo"
                subtitle="Visao rapida do torneio e do estado atual"
                icon={<CalendarDays className="h-6 w-6" />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard
                    label="Participantes"
                    value={String(participantList.length)}
                    helper="Grupo atual do bolao"
                  />
                  <StatCard
                    label="Jogos finalizados"
                    value={String(finishedGamesCount)}
                    helper="Resultados oficiais persistidos"
                  />
                  <StatCard
                    label="Palpites preenchidos"
                    value={String(predictionsCount)}
                    helper="Mantidos na navegacao via storage"
                  />
                  <StatCard
                    label="Investimento"
                    value={formatCurrency(TOURNAMENT_INVESTMENT_TOTAL)}
                    helper="Acerto final por participante"
                  />
                </div>
              </SectionCard>
            </div>
          </motion.div>
        )}

        {currentPage === "acesso" && (
          <motion.div key="tab-acesso" {...tabTransition}>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Acesso"
              subtitle="Selecione o participante para entrar no dashboard"
              icon={<UserCircle2 className="h-6 w-6" />}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {participantList.map((participant) => {
                  const isActive = participant.id === selectedUserId;

                  return (
                    <button
                      key={participant.id}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(participant.id);
                        router.push("/palpites");
                      }}
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
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white"
                          style={{ backgroundColor: participant.accentColor }}
                        >
                          {participant.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{participant.name}</p>
                          <p className="text-xs text-slate-400">
                            {isActive ? "Usuario ativo" : "Entrar no sistema"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                {selectedParticipant
                  ? `Usuario ativo: ${selectedParticipant.name}. Os palpites ficam abertos ate 1 minuto antes de cada partida.`
                  : "Selecione um participante para liberar a edicao dos palpites."}
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
              subtitle="Potes compartilhados, premios finais e janela de edicao"
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

              <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4 text-sm text-amber-100/90">
                Cada jogo forma 3 potes: resultado, gols e placar exato. Se
                ninguem acertar um criterio, o valor acumula para o proximo jogo.
                Os palpites podem ser editados ate 1 minuto antes do apito
                inicial.
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
        )}

        {currentPage === "palpites" && (
          <motion.div key="tab-palpites" {...tabTransition}>
          <SectionCard
            title="Dashboard"
            subtitle="Palpites dos grupos, 16 avos e fases seguintes"
            icon={<Swords className="h-6 w-6" />}
          >
            <div className="mb-6 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 font-medium text-emerald-100">
                  {selectedParticipant ? selectedParticipant.name : "Selecione um usuario"}
                </span>
                <span>
                  {selectedParticipant
                    ? "Os palpites ficam abertos ate 1 minuto antes de cada jogo."
                    : "Escolha um participante na pagina de acesso para liberar a edicao."}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {groupsData.map((group) => (
                <DashboardAccordion
                  key={group.id}
                  title={group.name}
                  subtitle="Jogos da fase de grupos"
                  games={groupGamesMap[group.id].length}
                  pendingCount={getPendingPredictionCount(groupGamesMap[group.id])}
                  isOpen={effectiveOpenDashboardSection === `group-${group.id}`}
                  onToggle={() => toggleDashboardSection(`group-${group.id}`)}
                >
                  {groupGamesMap[group.id].map((game) => (
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
                    />
                  ))}
                </DashboardAccordion>
              ))}

              {Object.entries(knockoutByRound).map(([roundLabel, games]) => (
                <DashboardAccordion
                  key={roundLabel}
                  title={roundLabel}
                  subtitle="Jogos do mata-mata"
                  games={games.length}
                  pendingCount={getPendingPredictionCount(games)}
                  isOpen={effectiveOpenDashboardSection === `knockout-${roundLabel}`}
                  onToggle={() => toggleDashboardSection(`knockout-${roundLabel}`)}
                >
                  {games.map((game) => (
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
                    />
                  ))}
                </DashboardAccordion>
              ))}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-amber-300" />
                    <h3 className="text-lg font-semibold text-white">Campeao da Copa</h3>
                  </div>
                  <input
                    type="text"
                    disabled={
                      !selectedParticipant || specialPickAvailability.status !== "open"
                    }
                    value={
                      effectiveSelectedUserId
                        ? getSpecialPick(
                            state.specialPicks,
                            effectiveSelectedUserId,
                          )?.champion ?? ""
                        : ""
                    }
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
                    disabled={
                      !selectedParticipant || specialPickAvailability.status !== "open"
                    }
                    value={
                      effectiveSelectedUserId
                        ? getSpecialPick(
                            state.specialPicks,
                            effectiveSelectedUserId,
                          )?.topScorer ?? ""
                        : ""
                    }
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
            </div>
          </SectionCard>
          </motion.div>
        )}

        {currentPage === "ranking" && (
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
                    <div key={entry.teamId} className="rounded-2xl border border-white/8 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        #{entry.thirdPlaceRank} terceiro
                      </p>
                      <p className="mt-2 font-semibold text-white">
                        {entry.groupId} · {entry.team.shortName}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {entry.points} pts · SG {entry.goalDifference} · GP {entry.goalsFor}
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
        )}

        {currentPage === "admin" && (
          <motion.div key="tab-admin" {...tabTransition}>
          <div className="space-y-6">
            <SectionCard
              title="Administracao"
              subtitle="Cards de grupos e mata-mata para inserir os resultados oficiais"
              icon={<ShieldCheck className="h-6 w-6" />}
            >
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100/90">
                Ao salvar resultados oficiais, o ranking, as tabelas dos grupos e o
                chaveamento do mata-mata sao atualizados automaticamente.
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
                {groupsData.map((group) => (
                  <DashboardAccordion
                    key={group.id}
                    title={group.name}
                    subtitle="Resultados oficiais e tabela do grupo"
                    games={groupGamesMap[group.id].length}
                    pendingCount={0}
                    isOpen={openAdminSection === `admin-group-${group.id}`}
                    onToggle={() => toggleAdminSection(`admin-group-${group.id}`)}
                  >
                    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                      <div className="grid min-w-0 gap-3">
                        {groupGamesMap[group.id].map((game) => {
                          const result = state.results.find((item) => item.gameId === game.id);

                          return (
                            <div
                              key={game.id}
                              className="rounded-3xl border border-white/8 bg-slate-950/30 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                    Jogo {game.matchNumber} · {game.matchdayLabel}
                                  </p>
                                  <p className="mt-1 font-semibold text-white">
                                    {game.homeTeam?.name} x {game.awayTeam?.name}
                                  </p>
                                </div>
                                <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={result?.finished ?? false}
                                    onChange={(event) =>
                                      handleResultFinished(game.id, event.target.checked)
                                    }
                                  />
                                  Encerrado
                                </label>
                              </div>

                              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-3">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={99}
                                  value={result?.homeScore ?? ""}
                                  onChange={(event) =>
                                    handleResultChange(
                                      game.id,
                                      "homeScore",
                                      event.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60"
                                />
                                <div className="flex items-center justify-center text-xl text-slate-500">
                                  x
                                </div>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={99}
                                  value={result?.awayScore ?? ""}
                                  onChange={(event) =>
                                    handleResultChange(
                                      game.id,
                                      "awayScore",
                                      event.target.value,
                                    )
                                  }
                                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmingOfficialGameId(game.id);
                                  setAdminResultError("");
                                  setAdminResultFeedback("");
                                }}
                                disabled={
                                  isSavingOfficialResult &&
                                  savingOfficialGameId === game.id
                                }
                                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSavingOfficialResult && savingOfficialGameId === game.id
                                  ? "Salvando..."
                                  : "Salvar resultado"}
                              </button>

                              {confirmingOfficialGameId === game.id && (
                                <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                                  <p className="font-medium text-white">
                                    Confirmar salvamento deste resultado?
                                  </p>
                                  <p className="mt-1 text-amber-100/90">
                                    Placar: {result?.homeScore ?? "-"} x{" "}
                                    {result?.awayScore ?? "-"} ·{" "}
                                    {result?.finished ? "Encerrado" : "Agendado"}
                                  </p>
                                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <button
                                      type="button"
                                      onClick={() => persistOfficialResult(game.id)}
                                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/15 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/20"
                                    >
                                      Confirmar e salvar no banco
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingOfficialGameId(null)}
                                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <StandingsTable standings={standingsByGroup[group.id]} />
                    </div>
                  </DashboardAccordion>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Mata-mata"
              subtitle="Cards oficiais do round of 32 ate a final"
              icon={<GitBranch className="h-6 w-6" />}
            >
              <div className="space-y-6">
                {Object.entries(knockoutByRound).map(([roundLabel, games]) => (
                  <div
                    key={roundLabel}
                    className="min-w-0 space-y-4 rounded-3xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{roundLabel}</h3>
                        <p className="text-sm text-slate-400">
                          Os confrontos aparecem automaticamente conforme a classificacao.
                        </p>
                      </div>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                        {games.length} jogos
                      </span>
                    </div>

                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                      {games.map((game) => {
                        const result = state.results.find((item) => item.gameId === game.id);

                        return (
                          <div
                            key={game.id}
                            className="rounded-3xl border border-white/8 bg-slate-950/30 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Jogo {game.matchNumber}
                                </p>
                                <div className="mt-2 space-y-1 font-semibold text-white">
                                  <div>
                                    <TeamLabel team={game.homeTeam} fallback="A definir" />
                                  </div>
                                  <div>
                                    <TeamLabel team={game.awayTeam} fallback="A definir" />
                                  </div>
                                </div>
                              </div>
                              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={result?.finished ?? false}
                                  onChange={(event) =>
                                    handleResultFinished(game.id, event.target.checked)
                                  }
                                />
                                Encerrado
                              </label>
                            </div>

                            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-3">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={99}
                                value={result?.homeScore ?? ""}
                                onChange={(event) =>
                                  handleResultChange(game.id, "homeScore", event.target.value)
                                }
                                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60"
                              />
                              <div className="flex items-center justify-center text-xl text-slate-500">
                                x
                              </div>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={99}
                                value={result?.awayScore ?? ""}
                                onChange={(event) =>
                                  handleResultChange(game.id, "awayScore", event.target.value)
                                }
                                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-center text-lg font-semibold text-white outline-none transition focus:border-emerald-400/60"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setConfirmingOfficialGameId(game.id);
                                setAdminResultError("");
                                setAdminResultFeedback("");
                              }}
                              disabled={
                                isSavingOfficialResult && savingOfficialGameId === game.id
                              }
                              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSavingOfficialResult && savingOfficialGameId === game.id
                                ? "Salvando..."
                                : "Salvar resultado"}
                            </button>

                            {confirmingOfficialGameId === game.id && (
                              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                                <p className="font-medium text-white">
                                  Confirmar salvamento deste resultado?
                                </p>
                                <p className="mt-1 text-amber-100/90">
                                  Placar: {result?.homeScore ?? "-"} x{" "}
                                  {result?.awayScore ?? "-"} ·{" "}
                                  {result?.finished ? "Encerrado" : "Agendado"}
                                </p>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <button
                                    type="button"
                                    onClick={() => persistOfficialResult(game.id)}
                                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/15 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/20"
                                  >
                                    Confirmar e salvar no banco
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingOfficialGameId(null)}
                                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
          </div>
          </motion.div>
        )}
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
                  Ao salvar, o novo participante entra imediatamente no acesso, no
                  ranking e no fluxo completo de palpites.
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
