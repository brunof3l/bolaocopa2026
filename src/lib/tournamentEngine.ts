import type {
  BestThirdEntry,
  Game,
  GroupDefinition,
  GroupId,
  KnockoutSlotAssignment,
  MatchResult,
  Prediction,
  PredictionReward,
  ResolvedGame,
  StandingEntry,
  Team,
  TeamSlotSource,
} from "@/types/bolao";

const resultReward = 0.5;
export const goalsReward = 1.0;
const exactScoreReward = 1.5;

function getMatchOutcome(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

export function calculatePredictionReward(
  prediction: Prediction | undefined,
  result: MatchResult | undefined,
): PredictionReward {
  if (
    !prediction ||
    !result?.finished ||
    result.homeScore === null ||
    result.awayScore === null ||
    prediction.homeScore === null ||
    prediction.awayScore === null
  ) {
    return {
      amount: 0,
      resultHit: false,
      goalsHit: false,
      exactHit: false,
      resultReward,
      goalsReward,
      exactScoreReward,
    };
  }

  const exactHit =
    prediction.homeScore === result.homeScore &&
    prediction.awayScore === result.awayScore;
  const resultHit =
    getMatchOutcome(prediction.homeScore, prediction.awayScore) ===
    getMatchOutcome(result.homeScore, result.awayScore);
  const goalsHit =
    resultHit &&
    !exactHit &&
    (prediction.homeScore === result.homeScore ||
      prediction.awayScore === result.awayScore);

  const amount =
    (resultHit ? resultReward : 0) +
    ((goalsHit || exactHit) ? goalsReward : 0) +
    (exactHit ? exactScoreReward : 0);

  return {
    amount,
    resultHit,
    goalsHit: goalsHit || exactHit,
    exactHit,
    resultReward,
    goalsReward,
    exactScoreReward,
  };
}

export function calculateStandings(
  group: GroupDefinition,
  games: Game[],
  results: MatchResult[],
  teamsById: Record<string, Team>,
): StandingEntry[] {
  const resultsByGame = new Map(results.map((result) => [result.gameId, result] as const));
  const groupGames = games.filter(
    (game) => game.stage === "group" && game.groupId === group.id,
  );

  const table = new Map(
    group.teams.map((team) => [
      team.id,
      {
        groupId: group.id,
        position: 0,
        teamId: team.id,
        team,
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      },
    ]),
  );

  for (const game of groupGames) {
    const result = resultsByGame.get(game.id);

    if (
      !result?.finished ||
      result.homeScore === null ||
      result.awayScore === null ||
      !game.homeTeamId ||
      !game.awayTeamId
    ) {
      continue;
    }

    const homeEntry = table.get(game.homeTeamId);
    const awayEntry = table.get(game.awayTeamId);

    if (!homeEntry || !awayEntry) {
      continue;
    }

    homeEntry.played += 1;
    awayEntry.played += 1;
    homeEntry.goalsFor += result.homeScore;
    homeEntry.goalsAgainst += result.awayScore;
    awayEntry.goalsFor += result.awayScore;
    awayEntry.goalsAgainst += result.homeScore;

    if (result.homeScore > result.awayScore) {
      homeEntry.wins += 1;
      awayEntry.losses += 1;
      homeEntry.points += 3;
    } else if (result.awayScore > result.homeScore) {
      awayEntry.wins += 1;
      homeEntry.losses += 1;
      awayEntry.points += 3;
    } else {
      homeEntry.draws += 1;
      awayEntry.draws += 1;
      homeEntry.points += 1;
      awayEntry.points += 1;
    }
  }

  return Array.from(table.values())
    .map((entry) => ({
      ...entry,
      goalDifference: entry.goalsFor - entry.goalsAgainst,
      team: teamsById[entry.teamId] ?? entry.team,
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      if (right.goalDifference !== left.goalDifference) {
        return right.goalDifference - left.goalDifference;
      }

      if (right.goalsFor !== left.goalsFor) {
        return right.goalsFor - left.goalsFor;
      }

      return left.team.name.localeCompare(right.team.name, "pt-BR");
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}

export function calculateAllStandings(
  groups: GroupDefinition[],
  games: Game[],
  results: MatchResult[],
  teamsById: Record<string, Team>,
) {
  return Object.fromEntries(
    groups.map((group) => [
      group.id,
      calculateStandings(group, games, results, teamsById),
    ]),
  ) as Record<GroupId, StandingEntry[]>;
}

export function rankThirdPlacedTeams(
  standingsByGroup: Record<GroupId, StandingEntry[]>,
): BestThirdEntry[] {
  return Object.values(standingsByGroup)
    .map((groupStandings) => groupStandings[2])
    .filter(Boolean)
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      if (right.goalDifference !== left.goalDifference) {
        return right.goalDifference - left.goalDifference;
      }

      if (right.goalsFor !== left.goalsFor) {
        return right.goalsFor - left.goalsFor;
      }

      return left.team.name.localeCompare(right.team.name, "pt-BR");
    })
    .map((entry, index) => ({
      ...entry,
      thirdPlaceRank: index + 1,
    }));
}

function resolveThirdPlaceSlots(
  games: Game[],
  qualifiedThirds: BestThirdEntry[],
): KnockoutSlotAssignment {
  const qualifiedGroups = qualifiedThirds.map((entry) => entry.groupId);
  const slots = games
    .filter((game) => game.stage === "round_of_32")
    .flatMap((game) => [game.homeSource, game.awaySource])
    .filter(
      (source): source is Extract<TeamSlotSource, { type: "best_third" }> =>
        source?.type === "best_third",
    )
    .map((source) => ({
      slotId: source.slotId,
      eligibleGroups: source.candidateGroups.filter((groupId) =>
        qualifiedGroups.includes(groupId),
      ),
    }))
    .sort((left, right) => left.eligibleGroups.length - right.eligibleGroups.length);

  const assignment: KnockoutSlotAssignment = {};
  const usedGroups = new Set<GroupId>();

  function backtrack(index: number): boolean {
    if (index === slots.length) {
      return true;
    }

    const slot = slots[index];

    for (const groupId of slot.eligibleGroups) {
      if (usedGroups.has(groupId)) {
        continue;
      }

      assignment[slot.slotId] = groupId;
      usedGroups.add(groupId);

      if (backtrack(index + 1)) {
        return true;
      }

      usedGroups.delete(groupId);
      delete assignment[slot.slotId];
    }

    return false;
  }

  backtrack(0);

  return assignment;
}

function getResultMap(results: MatchResult[]) {
  return new Map(results.map((result) => [result.gameId, result] as const));
}

function getWinner(game: ResolvedGame, result: MatchResult | undefined) {
  if (
    !result?.finished ||
    result.homeScore === null ||
    result.awayScore === null ||
    !game.homeTeam ||
    !game.awayTeam
  ) {
    return null;
  }

  if (result.homeScore > result.awayScore) {
    return game.homeTeam;
  }

  if (result.awayScore > result.homeScore) {
    return game.awayTeam;
  }

  return null;
}

function getLoser(game: ResolvedGame, result: MatchResult | undefined) {
  if (
    !result?.finished ||
    result.homeScore === null ||
    result.awayScore === null ||
    !game.homeTeam ||
    !game.awayTeam
  ) {
    return null;
  }

  if (result.homeScore > result.awayScore) {
    return game.awayTeam;
  }

  if (result.awayScore > result.homeScore) {
    return game.homeTeam;
  }

  return null;
}

export function generateKnockoutBracket(
  games: Game[],
  standingsByGroup: Record<GroupId, StandingEntry[]>,
  results: MatchResult[],
  teamsById: Record<string, Team>,
) {
  const resultMap = getResultMap(results);
  const qualifiedThirds = rankThirdPlacedTeams(standingsByGroup).slice(0, 8);
  const thirdPlaceAssignments = resolveThirdPlaceSlots(games, qualifiedThirds);
  const qualifiedThirdsByGroup = Object.fromEntries(
    qualifiedThirds.map((entry) => [entry.groupId, entry] as const),
  ) as Partial<Record<GroupId, BestThirdEntry>>;

  const knockoutGames = games.filter((game) => game.stage !== "group");
  const resolvedGames = new Map<string, ResolvedGame>();

  function resolveSource(source: TeamSlotSource | undefined): Team | null {
    if (!source) {
      return null;
    }

    if (source.type === "group_position") {
      return standingsByGroup[source.groupId]?.[source.position - 1]?.team ?? null;
    }

    if (source.type === "best_third") {
      const assignedGroup = thirdPlaceAssignments[source.slotId];
      return assignedGroup ? qualifiedThirdsByGroup[assignedGroup]?.team ?? null : null;
    }

    const previousGame = knockoutGames.find((game) => game.id === source.matchId);

    if (!previousGame) {
      return null;
    }

    const resolvedPrevious = resolveGame(previousGame);
    const previousResult = resultMap.get(previousGame.id);

    return source.type === "winner"
      ? getWinner(resolvedPrevious, previousResult)
      : getLoser(resolvedPrevious, previousResult);
  }

  function resolveGame(game: Game): ResolvedGame {
    const cached = resolvedGames.get(game.id);

    if (cached) {
      return cached;
    }

    const resolvedGame: ResolvedGame = {
      ...game,
      homeTeam: game.homeTeamId ? teamsById[game.homeTeamId] ?? null : resolveSource(game.homeSource),
      awayTeam: game.awayTeamId ? teamsById[game.awayTeamId] ?? null : resolveSource(game.awaySource),
    };

    resolvedGames.set(game.id, resolvedGame);
    return resolvedGame;
  }

  return {
    qualifiedThirds,
    thirdPlaceAssignments,
    games: knockoutGames
      .slice()
      .sort((left, right) => left.matchNumber - right.matchNumber)
      .map(resolveGame),
  };
}
