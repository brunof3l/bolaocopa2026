"use client";

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

import { seedUsersIfMissingAction } from "@/app/actions/match-actions";
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
  getSpecialPick,
  groupGamesByStage,
  scoringRules,
  upsertPrediction,
  upsertResult,
} from "@/lib/bolao";
import {
  calculateAllStandings,
  generateKnockoutBracket,
  rankThirdPlacedTeams,
} from "@/lib/tournamentEngine";
import type {
  AppState,
  GroupId,
  MatchResult,
  Participant,
  Prediction,
  ResolvedGame,
  StandingEntry,
  Team,
} from "@/types/bolao";

type TabKey = "acesso" | "palpites" | "ranking" | "admin";
const LOCAL_STORAGE_PARTICIPANTS_KEY = "bolao-copa-2026-participants";
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

const tabs: Array<{
  key: TabKey;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: "acesso",
    label: "Acesso",
    description: "Entrar e ver regras",
    icon: <LogIn className="h-4 w-4" />,
  },
  {
    key: "palpites",
    label: "Palpites",
    description: "Janela de 48h e edicao",
    icon: <Swords className="h-4 w-4" />,
  },
  {
    key: "ranking",
    label: "Ranking",
    description: "Tabela e chaveamento",
    icon: <Medal className="h-4 w-4" />,
  },
  {
    key: "admin",
    label: "Admin",
    description: "Resultados oficiais",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
];

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
    <section className="glass-surface rounded-3xl p-5 transition-transform duration-300 hover:scale-[1.01] md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-bolao-accent/80">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white md:text-2xl">
            {subtitle}
          </h2>
        </div>
        <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/80 p-3 text-emerald-300">
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
    <div className="glass-surface rounded-2xl p-4 transition-transform duration-300 hover:scale-[1.02]">
      <p className="text-sm text-bolao-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
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
    <div className="glass-surface premium-scrollbar overflow-x-auto rounded-3xl">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="px-3 py-3">Pos</th>
            <th className="px-3 py-3">Selecao</th>
            <th className="px-3 py-3">PTS</th>
            <th className="px-3 py-3">J</th>
            <th className="px-3 py-3">V</th>
            <th className="px-3 py-3">E</th>
            <th className="px-3 py-3">D</th>
            <th className="px-3 py-3">GP</th>
            <th className="px-3 py-3">GC</th>
            <th className="px-3 py-3">SG</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry) => (
            <tr key={entry.teamId} className="border-t border-white/8 text-slate-200">
              <td className="px-3 py-3">{entry.position}</td>
              <td className="px-3 py-3 font-medium text-white">
                <span className="inline-flex items-center gap-2">
                  <CountryFlag code={entry.team.code} name={entry.team.name} />
                  {entry.team.shortName}
                </span>
              </td>
              <td className="px-3 py-3">{entry.points}</td>
              <td className="px-3 py-3">{entry.played}</td>
              <td className="px-3 py-3">{entry.wins}</td>
              <td className="px-3 py-3">{entry.draws}</td>
              <td className="px-3 py-3">{entry.losses}</td>
              <td className="px-3 py-3">{entry.goalsFor}</td>
              <td className="px-3 py-3">{entry.goalsAgainst}</td>
              <td className="px-3 py-3">{entry.goalDifference}</td>
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
    <div className="space-y-3">
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
  now,
  onPredictionChange,
}: {
  game: ResolvedGame;
  selectedUserId: string | null;
  selectedParticipant: { id: string; name: string } | null;
  predictions: AppState["predictions"];
  results: AppState["results"];
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
  const reward = getPredictionReward(prediction, result);
  const availability = getPredictionAvailability(game, now);
  const isEditable = Boolean(selectedParticipant) && availability.status === "open";

  return (
    <article className="glass-surface rounded-3xl p-4 transition-transform duration-300 hover:scale-[1.02]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Jogo {game.matchNumber}
              {game.matchdayLabel ? ` · ${game.matchdayLabel}` : ""}
            </p>
            <div className="mt-2 flex items-center justify-center gap-3 text-center text-base font-semibold text-white md:justify-start">
              <TeamLabel team={game.homeTeam} fallback="A definir" />
              <span className="text-slate-500">x</span>
              <TeamLabel team={game.awayTeam} fallback="A definir" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 px-4 py-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-300" />
              <span>{formatKickoff(game.kickoff)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{game.stadium}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
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
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-center text-xl font-semibold text-white outline-none transition focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-center text-xl font-semibold text-white outline-none transition focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
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
              Retorno:{" "}
              <span
                className={`font-semibold ${
                  reward.amount > 0 ? "text-emerald-300" : "text-bolao-zero"
                }`}
              >
                {formatCurrency(reward.amount)}
              </span>
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
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.03] active:scale-[0.99] md:p-5"
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

        <div className="flex items-center gap-3">
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
  initialRemoteUserNames = [],
}: {
  initialRemoteUserNames?: string[];
}) {
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
  const [state, setState] = useState<AppState>(initialState);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("acesso");
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

  const now = new Date();
  const selectedParticipant =
    participantList.find((participant) => participant.id === selectedUserId) ?? null;

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

  const predictionsCount = state.predictions.filter(
    (prediction) =>
      prediction.homeScore !== null && prediction.awayScore !== null,
  ).length;
  const finishedGamesCount = state.results.filter((result) => result.finished).length;
  const currentTab = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const exactLeaderCount = Math.max(...ranking.map((entry) => entry.exactHits), 0);
  const exactLeaders = ranking.filter(
    (entry) => exactLeaderCount > 0 && entry.exactHits === exactLeaderCount,
  );
  const championWinners = ranking.filter((entry) => entry.championHit);
  const topScorerWinners = ranking.filter((entry) => entry.topScorerHit);

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
    if (!selectedUserId) {
      return 0;
    }

    return games.filter((game) => {
      const availability = getPredictionAvailability(game, now);
      const prediction = getPrediction(state.predictions, selectedUserId, game.id);

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
    if (!selectedUserId) {
      return;
    }

    const game = allResolvedGames.find((item) => item.id === gameId);

    if (!game || getPredictionAvailability(game, now).status !== "open") {
      return;
    }

    setState((currentState) => {
      const existingPrediction = getPrediction(
        currentState.predictions,
        selectedUserId,
        gameId,
      );

      const nextPrediction: Prediction = {
        userId: selectedUserId,
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
    if (!selectedUserId) {
      return;
    }

    setState((currentState) => {
      const nextSpecialPicks = currentState.specialPicks.map((pick) =>
        pick.userId === selectedUserId ? { ...pick, [field]: value } : pick,
      );

      return {
        ...currentState,
        specialPicks:
          nextSpecialPicks.some((pick) => pick.userId === selectedUserId)
            ? nextSpecialPicks
            : [
                ...currentState.specialPicks,
                {
                  userId: selectedUserId,
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
      setActiveTab("palpites");
    }, 500);
  }

  function resetDemoData() {
    setState(initialState);
    setParticipantList(mergeParticipants(participants, initialRemoteUserNames));
    setSelectedUserId(null);
    setActiveTab("acesso");
    setIsCreateParticipantOpen(false);
    setParticipantFormError("");
    setParticipantFormSuccess("");
    setNewParticipantName("");
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_PARTICIPANTS_KEY);
    } catch {
      // Mantem o reset funcional mesmo sem acesso ao storage.
    }
  }

  return (
    <main className="min-h-screen bg-bolao-bg text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <header className="glass-surface overflow-hidden rounded-[2rem] p-5 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                <Trophy className="h-4 w-4" />
                Bolao Copa 2026
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white md:text-5xl">
                Motor completo de grupos, 16 avos e painel admin em tempo real.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                O sistema agora considera 48 selecoes, 12 grupos, classificacao
                automatica, 8 melhores terceiros colocados, chaveamento do
                mata-mata e bloqueio de palpites por janela de 48 horas.
              </p>
              <div className="rounded-2xl border border-white/8 bg-bolao-surfaceElevated/70 px-4 py-3 text-sm text-slate-300">
                Agora: <span className="font-semibold text-white">{formatFullDateTime(now.toISOString())}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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

        <section className="glass-surface rounded-3xl p-3">
          <div className="grid gap-2 md:grid-cols-4">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-2xl border px-4 py-3 text-left transition active:scale-95 ${
                    isActive
                      ? "border-emerald-300/40 bg-emerald-400/12 text-white shadow-[0_12px_30px_rgba(16,185,129,0.12)]"
                      : "border-white/8 bg-white/[0.03] text-slate-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {tab.icon}
                    {tab.label}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{tab.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            <span className="font-semibold text-white">{currentTab.label}</span>
            {selectedParticipant
              ? ` · Usuario ativo: ${selectedParticipant.name}`
              : " · Nenhum usuario selecionado"}
          </div>
        </section>

        <AnimatePresence mode="wait">
        {activeTab === "acesso" && (
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
                        setActiveTab("palpites");
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
                  ? `Usuario ativo: ${selectedParticipant.name}. A aba de palpites respeita a janela de 48h para cada partida.`
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
              subtitle="Pontuacao e janela de liberacao dos palpites"
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
                O palpite so abre exatamente 48 horas antes do jogo. Antes disso o
                card mostra &quot;Abre em...&quot;. Depois do inicio da partida, a edicao fica
                bloqueada permanentemente.
              </div>

              <div className="mt-4 grid gap-3">
                {awardRules.map((award) => (
                  <div
                    key={award.label}
                    className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-white">{award.label}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Premio atual: {formatCurrency(award.prize)}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
          </motion.div>
        )}

        {activeTab === "palpites" && (
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
                    ? "Os cards abrem apenas dentro da janela de 48 horas."
                    : "Escolha um participante na aba de acesso para liberar a edicao."}
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
                      selectedUserId={selectedUserId}
                      selectedParticipant={selectedParticipant}
                      predictions={state.predictions}
                      results={state.results}
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
                      selectedUserId={selectedUserId}
                      selectedParticipant={selectedParticipant}
                      predictions={state.predictions}
                      results={state.results}
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
                    disabled={!selectedParticipant}
                    value={
                      selectedUserId
                        ? getSpecialPick(state.specialPicks, selectedUserId)?.champion ?? ""
                        : ""
                    }
                    onChange={(event) =>
                      handleSpecialPickChange("champion", event.target.value)
                    }
                    placeholder="Ex.: Brasil"
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    <Goal className="h-5 w-5 text-sky-300" />
                    <h3 className="text-lg font-semibold text-white">Artilheiro da Copa</h3>
                  </div>
                  <input
                    type="text"
                    disabled={!selectedParticipant}
                    value={
                      selectedUserId
                        ? getSpecialPick(state.specialPicks, selectedUserId)?.topScorer ?? ""
                        : ""
                    }
                    onChange={(event) =>
                      handleSpecialPickChange("topScorer", event.target.value)
                    }
                    placeholder="Ex.: Mbappe"
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-sky-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </SectionCard>
          </motion.div>
        )}

        {activeTab === "ranking" && (
          <motion.div key="tab-ranking" {...tabTransition}>
          <div className="space-y-6">
            <SectionCard
              title="Leaderboard"
              subtitle="Saldo acumulado, premios e desempenhos do bolao"
              icon={<Medal className="h-6 w-6" />}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border border-amber-300/15 bg-amber-300/5 p-4">
                  <p className="text-sm text-amber-100/80">Lider em cravos</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {exactLeaders.length
                      ? exactLeaders.map((entry) => entry.name).join(", ")
                      : "Sem lider ainda"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Premio de R$ 20,00</p>
                </div>
                <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/5 p-4">
                  <p className="text-sm text-emerald-100/80">Acertou o campeao</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {championWinners.length
                      ? championWinners.map((entry) => entry.name).join(", ")
                      : "Aguardando definicao oficial"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Premio de R$ 30,00</p>
                </div>
                <div className="rounded-3xl border border-sky-300/15 bg-sky-300/5 p-4">
                  <p className="text-sm text-sky-100/80">Acertou o artilheiro</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {topScorerWinners.length
                      ? topScorerWinners.map((entry) => entry.name).join(", ")
                      : "Aguardando definicao oficial"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Premio de R$ 5,00</p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-3xl border border-white/8 bg-black/20">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Pos.</th>
                      <th className="px-4 py-3 font-medium">Participante</th>
                      <th className="px-4 py-3 font-medium">Saldo</th>
                      <th className="px-4 py-3 font-medium">Cravos</th>
                      <th className="px-4 py-3 font-medium">Resultados certos</th>
                      <th className="px-4 py-3 font-medium">Campeao</th>
                      <th className="px-4 py-3 font-medium">Artilheiro</th>
                      <th className="px-4 py-3 font-medium">Premios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((entry, index) => (
                      <tr
                        key={entry.userId}
                        className="border-t border-white/8 text-slate-200"
                      >
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-white">{entry.name}</td>
                        <td className="px-4 py-3">{formatCurrency(entry.balance)}</td>
                        <td className="px-4 py-3">{entry.exactHits}</td>
                        <td className="px-4 py-3">{entry.resultHits}</td>
                        <td className="px-4 py-3">{entry.championHit ? "Sim" : "Nao"}</td>
                        <td className="px-4 py-3">{entry.topScorerHit ? "Sim" : "Nao"}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(entry.paidAwardsTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Grupos"
              subtitle="Tabelas dinamicas com criterios FIFA: pontos, saldo e gols pro"
              icon={<Table2 className="h-6 w-6" />}
            >
              <div className="grid gap-4 xl:grid-cols-2">
                {groupsData.map((group) => (
                  <div key={group.id} className="space-y-3 rounded-3xl border border-white/8 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                        3o lugar atual: {standingsByGroup[group.id][2]?.team.shortName ?? "-"}
                      </span>
                    </div>
                    <StandingsTable standings={standingsByGroup[group.id]} />
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-white/8 bg-black/20 p-4">
                <h3 className="text-lg font-semibold text-white">
                  Ranking dos terceiros colocados
                </h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              <div className="grid gap-4 xl:grid-cols-4">
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

        {activeTab === "admin" && (
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
                    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                      <div className="grid gap-3">
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
                  <div key={roundLabel} className="space-y-4 rounded-3xl border border-white/8 bg-black/20 p-4">
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

                    <div className="grid gap-3 md:grid-cols-2">
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

                <div className="flex gap-3">
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
