import type {
  BestThirdEntry,
  Game,
  GroupDefinition,
  GroupId,
  KnockoutSlotAssignment,
  MatchPoolBreakdown,
  MatchResult,
  Prediction,
  PredictionReward,
  ResolvedGame,
  SharedPot,
  StandingEntry,
  Team,
  TeamSlotSource,
  TournamentFinanceSummary,
  AppState,
  Participant,
  SpecialPick,
} from "@/types/bolao";

export const sharedPotContribution = {
  result: 0.5,
  goals: 1.0,
  exact: 1.5,
} as const;

export const TOURNAMENT_INVESTMENT_TOTAL = 367;
export const goalsReward = sharedPotContribution.goals;

function getMatchOutcome(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function roundDownCurrency(value: number) {
  return Math.floor((value + Number.EPSILON) * 100) / 100;
}

function createSharedPot(
  overrides: Partial<SharedPot> = {},
): SharedPot {
  return {
    result: 0,
    goals: 0,
    exact: 0,
    ...overrides,
  };
}

function addSharedPots(left: SharedPot, right: SharedPot): SharedPot {
  return createSharedPot({
    result: roundCurrency(left.result + right.result),
    goals: roundCurrency(left.goals + right.goals),
    exact: roundCurrency(left.exact + right.exact),
  });
}

function multiplySharedPot(multiplier: number): SharedPot {
  return createSharedPot({
    result: roundCurrency(multiplier * sharedPotContribution.result),
    goals: roundCurrency(multiplier * sharedPotContribution.goals),
    exact: roundCurrency(multiplier * sharedPotContribution.exact),
  });
}

export function getPredictionHits(
  prediction: Prediction | undefined,
  result: MatchResult | undefined,
) {
  if (
    !prediction ||
    !result?.finished ||
    result.homeScore === null ||
    result.awayScore === null ||
    prediction.homeScore === null ||
    prediction.awayScore === null
  ) {
    return {
      resultHit: false,
      goalsHit: false,
      exactHit: false,
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
    (prediction.homeScore === result.homeScore ||
      prediction.awayScore === result.awayScore);

  return {
    resultHit,
    goalsHit,
    exactHit,
  };
}

export function calculatePredictionReward(
  prediction: Prediction | undefined,
  result: MatchResult | undefined,
  breakdown?: MatchPoolBreakdown,
): PredictionReward {
  const { resultHit, goalsHit, exactHit } = getPredictionHits(prediction, result);
  const resultAmount =
    prediction && resultHit && breakdown
      ? breakdown.payoutPerWinner.result
      : 0;
  const goalsAmount =
    prediction && goalsHit && breakdown
      ? breakdown.payoutPerWinner.goals
      : 0;
  const exactAmount =
    prediction && exactHit && breakdown
      ? breakdown.payoutPerWinner.exact
      : 0;

  return {
    amount: roundCurrency(resultAmount + goalsAmount + exactAmount),
    resultHit,
    goalsHit,
    exactHit,
    resultAmount,
    goalsAmount,
    exactAmount,
  };
}

function getResultMap(results: MatchResult[]) {
  return new Map(results.map((result) => [result.gameId, result] as const));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTeamLookup(games: Array<Game | ResolvedGame>) {
  const lookup = new Map<string, string>();

  for (const game of games) {
    const candidates =
      "homeTeam" in game
        ? [game.homeTeam, game.awayTeam]
        : [];

    for (const team of candidates) {
      if (!team) {
        continue;
      }

      lookup.set(normalizeText(team.id), team.id);
      lookup.set(normalizeText(team.name), team.id);
      lookup.set(normalizeText(team.shortName), team.id);
    }
  }

  return lookup;
}

function getTeamProgressScores(games: Array<Game | ResolvedGame>, results: MatchResult[]) {
  const stageScoreMap: Record<string, number> = {
    group: 1,
    round_of_32: 2,
    round_of_16: 3,
    quarterfinal: 4,
    semifinal: 5,
    third_place: 5,
    final: 6,
  };
  const progress = new Map<string, number>();
  const resultMap = getResultMap(results);

  for (const game of games) {
    const homeTeamId = "homeTeam" in game ? game.homeTeam?.id ?? null : game.homeTeamId;
    const awayTeamId = "awayTeam" in game ? game.awayTeam?.id ?? null : game.awayTeamId;
    const stageScore = stageScoreMap[game.stage] ?? 0;

    if (homeTeamId) {
      progress.set(homeTeamId, Math.max(progress.get(homeTeamId) ?? 0, stageScore));
    }

    if (awayTeamId) {
      progress.set(awayTeamId, Math.max(progress.get(awayTeamId) ?? 0, stageScore));
    }

    const result = resultMap.get(game.id);

    if (
      game.stage === "final" &&
      result?.finished &&
      result.homeScore !== null &&
      result.awayScore !== null
    ) {
      const championTeamId =
        result.homeScore > result.awayScore ? homeTeamId : awayTeamId;

      if (championTeamId) {
        progress.set(championTeamId, 7);
      }
    }
  }

  return progress;
}

function getFinalAwardWinners(
  participants: Participant[],
  specialPicks: SpecialPick[],
  officialChampion: string | null,
  officialTopScorer: string | null,
  games: Array<Game | ResolvedGame>,
  results: MatchResult[],
  exactHitsByUser: Record<string, number>,
) {
  const participantCount = participants.length;
  const teamProgress = getTeamProgressScores(games, results);
  const teamLookup = buildTeamLookup(games);
  const picksByUser = new Map(specialPicks.map((pick) => [pick.userId, pick] as const));
  const exactHitsPot = roundCurrency(participantCount * 20);
  const championPot = roundCurrency(participantCount * 30);
  const topScorerPot = roundCurrency(participantCount * 5);
  const officialChampionNormalized = normalizeText(officialChampion);
  const officialTopScorerNormalized = normalizeText(officialTopScorer);

  const exactHitLeaders = participants
    .map((participant) => ({
      userId: participant.id,
      exactHits: exactHitsByUser[participant.id] ?? 0,
    }))
    .sort((left, right) => right.exactHits - left.exactHits);
  const maxExactHits = exactHitLeaders[0]?.exactHits ?? 0;
  const exactHitsWinners = exactHitLeaders
    .filter((entry) => entry.exactHits === maxExactHits)
    .map((entry) => entry.userId);
  const exactHitsAwardPerWinner = exactHitsWinners.length
    ? roundDownCurrency(exactHitsPot / exactHitsWinners.length)
    : 0;

  let championWinners: string[] = [];

  if (officialChampion) {
    championWinners = participants
      .filter(
        (participant) =>
          normalizeText(picksByUser.get(participant.id)?.champion) ===
          officialChampionNormalized,
      )
      .map((participant) => participant.id);

    if (!championWinners.length) {
      const farthest = participants.map((participant) => {
        const selectedChampion = picksByUser.get(participant.id)?.champion ?? "";
        const selectedChampionId =
          teamLookup.get(normalizeText(selectedChampion)) ?? normalizeText(selectedChampion);
        return {
          userId: participant.id,
          progress: teamProgress.get(selectedChampionId) ?? 0,
        };
      });
      const maxProgress = Math.max(...farthest.map((entry) => entry.progress), 0);
      championWinners = farthest
        .filter((entry) => entry.progress === maxProgress)
        .map((entry) => entry.userId);
    }
  }

  const championAwardPerWinner = championWinners.length
    ? roundDownCurrency(championPot / championWinners.length)
    : 0;

  const topScorerWinners = officialTopScorer
    ? participants
        .filter(
          (participant) =>
            normalizeText(picksByUser.get(participant.id)?.topScorer) ===
            officialTopScorerNormalized,
        )
        .map((participant) => participant.id)
    : [];
  const topScorerAwardPerWinner = topScorerWinners.length
    ? roundDownCurrency(topScorerPot / topScorerWinners.length)
    : 0;

  return {
    championWinners,
    championAwardPerWinner,
    championPot,
    exactHitsWinners,
    exactHitsAwardPerWinner,
    exactHitsPot,
    topScorerWinners,
    topScorerAwardPerWinner,
    topScorerPot,
  };
}

export function calculateTournamentFinance(
  participants: Participant[],
  games: Array<Game | ResolvedGame>,
  state: AppState,
): TournamentFinanceSummary {
  const participantCount = participants.length;
  const sortedGames = [...games].sort(
    (left, right) =>
      new Date(left.kickoff).getTime() - new Date(right.kickoff).getTime(),
  );
  const resultMap = getResultMap(state.results);
  const winningsByUser = Object.fromEntries(
    participants.map((participant) => [participant.id, 0] as const),
  ) as Record<string, number>;
  const exactHitsByUser = Object.fromEntries(
    participants.map((participant) => [participant.id, 0] as const),
  ) as Record<string, number>;
  const resultHitsByUser = Object.fromEntries(
    participants.map((participant) => [participant.id, 0] as const),
  ) as Record<string, number>;
  const matchBreakdowns: Record<string, MatchPoolBreakdown> = {};
  let carry = createSharedPot();

  for (const game of sortedGames) {
    const result = resultMap.get(game.id);
    const basePot = multiplySharedPot(participantCount);
    const totalPot = addSharedPots(basePot, carry);
    const predictions = participants
      .map((participant) =>
        state.predictions.find(
          (prediction) =>
            prediction.userId === participant.id && prediction.gameId === game.id,
        ),
      )
      .filter(Boolean) as Prediction[];

    const winners = {
      result: [] as string[],
      goals: [] as string[],
      exact: [] as string[],
    };

    for (const prediction of predictions) {
      const hits = getPredictionHits(prediction, result);

      if (hits.resultHit) {
        winners.result.push(prediction.userId);
        resultHitsByUser[prediction.userId] =
          (resultHitsByUser[prediction.userId] ?? 0) + 1;
      }

      if (hits.goalsHit) {
        winners.goals.push(prediction.userId);
      }

      if (hits.exactHit) {
        winners.exact.push(prediction.userId);
        exactHitsByUser[prediction.userId] =
          (exactHitsByUser[prediction.userId] ?? 0) + 1;
      }
    }

    const isSettled =
      Boolean(result?.finished) &&
      result?.homeScore !== null &&
      result?.awayScore !== null;

    const payoutPerWinner = createSharedPot({
      result:
        isSettled && winners.result.length
          ? roundDownCurrency(totalPot.result / winners.result.length)
          : 0,
      goals:
        isSettled && winners.goals.length
          ? roundDownCurrency(totalPot.goals / winners.goals.length)
          : 0,
      exact:
        isSettled && winners.exact.length
          ? roundDownCurrency(totalPot.exact / winners.exact.length)
          : 0,
    });

    const distributed = createSharedPot({
      result: roundCurrency(payoutPerWinner.result * winners.result.length),
      goals: roundCurrency(payoutPerWinner.goals * winners.goals.length),
      exact: roundCurrency(payoutPerWinner.exact * winners.exact.length),
    });
    const rolloverOut = isSettled
      ? createSharedPot({
          result:
            winners.result.length > 0
              ? roundCurrency(totalPot.result - distributed.result)
              : totalPot.result,
          goals:
            winners.goals.length > 0
              ? roundCurrency(totalPot.goals - distributed.goals)
              : totalPot.goals,
          exact:
            winners.exact.length > 0
              ? roundCurrency(totalPot.exact - distributed.exact)
              : totalPot.exact,
        })
      : carry;

    const earningsByUser: Record<string, number> = {};

    for (const winnerId of winners.result) {
      earningsByUser[winnerId] = roundCurrency(
        (earningsByUser[winnerId] ?? 0) + payoutPerWinner.result,
      );
      winningsByUser[winnerId] = roundCurrency(
        (winningsByUser[winnerId] ?? 0) + payoutPerWinner.result,
      );
    }

    for (const winnerId of winners.goals) {
      earningsByUser[winnerId] = roundCurrency(
        (earningsByUser[winnerId] ?? 0) + payoutPerWinner.goals,
      );
      winningsByUser[winnerId] = roundCurrency(
        (winningsByUser[winnerId] ?? 0) + payoutPerWinner.goals,
      );
    }

    for (const winnerId of winners.exact) {
      earningsByUser[winnerId] = roundCurrency(
        (earningsByUser[winnerId] ?? 0) + payoutPerWinner.exact,
      );
      winningsByUser[winnerId] = roundCurrency(
        (winningsByUser[winnerId] ?? 0) + payoutPerWinner.exact,
      );
    }

    matchBreakdowns[game.id] = {
      gameId: game.id,
      winners,
      incomingRollover: carry,
      basePot,
      totalPot,
      payoutPerWinner,
      distributed,
      rolloverOut,
      earningsByUser,
    };

    if (isSettled) {
      carry = rolloverOut;
    }
  }

  const finalAwards = getFinalAwardWinners(
    participants,
    state.specialPicks,
    state.awards.champion,
    state.awards.topScorer,
    games,
    state.results,
    exactHitsByUser,
  );

  for (const userId of finalAwards.exactHitsWinners) {
    winningsByUser[userId] = roundCurrency(
      (winningsByUser[userId] ?? 0) + finalAwards.exactHitsAwardPerWinner,
    );
  }

  for (const userId of finalAwards.championWinners) {
    winningsByUser[userId] = roundCurrency(
      (winningsByUser[userId] ?? 0) + finalAwards.championAwardPerWinner,
    );
  }

  for (const userId of finalAwards.topScorerWinners) {
    winningsByUser[userId] = roundCurrency(
      (winningsByUser[userId] ?? 0) + finalAwards.topScorerAwardPerWinner,
    );
  }

  return {
    participantCount,
    matchBreakdowns,
    winningsByUser,
    exactHitsByUser,
    resultHitsByUser,
    finalAwards,
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
