import type {
  AppState,
  Game,
  MatchPoolBreakdown,
  MatchResult,
  Participant,
  PredictionAvailability,
  Prediction,
  PredictionReward,
  RankingEntry,
  ResolvedGame,
  SpecialPick,
} from "@/types/bolao";
import {
  calculatePredictionReward,
  calculateTournamentFinance,
  TOURNAMENT_INVESTMENT_TOTAL,
} from "@/lib/tournamentEngine";

export function getFlagEmoji(countryCode: string) {
  if (!/^[A-Z]{2}$/i.test(countryCode)) {
    return "🏳️";
  }

  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export function formatKickoff(dateString: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function formatFullDateTime(dateString: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getPredictionReward(
  prediction: Prediction | undefined,
  result: MatchResult | undefined,
  breakdown?: MatchPoolBreakdown,
) : PredictionReward {
  return calculatePredictionReward(prediction, result, breakdown);
}

export function groupGamesByMatchday(games: Game[]) {
  return games.reduce<Record<string, Game[]>>((accumulator, game) => {
    if (!accumulator[game.matchdayLabel]) {
      accumulator[game.matchdayLabel] = [];
    }

    accumulator[game.matchdayLabel].push(game);
    return accumulator;
  }, {});
}

export function groupGamesByStage(games: ResolvedGame[]) {
  return games.reduce<Record<string, ResolvedGame[]>>((accumulator, game) => {
    if (!accumulator[game.roundLabel]) {
      accumulator[game.roundLabel] = [];
    }

    accumulator[game.roundLabel].push(game);
    return accumulator;
  }, {});
}

export function getPrediction(
  predictions: Prediction[],
  userId: string,
  gameId: string,
) {
  return predictions.find(
    (prediction) => prediction.userId === userId && prediction.gameId === gameId,
  );
}

export function getSpecialPick(specialPicks: SpecialPick[], userId: string) {
  return specialPicks.find((pick) => pick.userId === userId);
}

export function buildRanking(
  participants: Participant[],
  games: Array<Game | ResolvedGame>,
  state: AppState,
): RankingEntry[] {
  const financeSummary = calculateTournamentFinance(participants, games, state);

  return participants
    .map((participant) => {
      const grossWinnings = financeSummary.winningsByUser[participant.id] ?? 0;
      const championHit = financeSummary.finalAwards.championWinners.includes(participant.id);
      const topScorerHit = financeSummary.finalAwards.topScorerWinners.includes(
        participant.id,
      );
      const championAward = championHit
        ? financeSummary.finalAwards.championAwardPerWinner
        : 0;
      const topScorerAward = topScorerHit
        ? financeSummary.finalAwards.topScorerAwardPerWinner
        : 0;
      const exactHitsAward = financeSummary.finalAwards.exactHitsWinners.includes(
        participant.id,
      )
        ? financeSummary.finalAwards.exactHitsAwardPerWinner
        : 0;
      const finalAwardsWinnings = championAward + topScorerAward + exactHitsAward;
      const matchWinnings = grossWinnings - finalAwardsWinnings;
      const netSettlement = grossWinnings - TOURNAMENT_INVESTMENT_TOTAL;
      const settlementLabel: RankingEntry["settlementLabel"] =
        netSettlement > 0
          ? "A Receber"
          : netSettlement < 0
            ? "A Pagar"
            : "Zerado";

      return {
        userId: participant.id,
        name: participant.name,
        grossWinnings,
        matchWinnings,
        finalAwardsWinnings,
        netSettlement,
        exactHits: financeSummary.exactHitsByUser[participant.id] ?? 0,
        resultHits: financeSummary.resultHitsByUser[participant.id] ?? 0,
        championHit,
        topScorerHit,
        championAward,
        topScorerAward,
        exactHitsAward,
        settlementLabel,
      };
    })
    .sort((left, right) => {
      if (right.grossWinnings !== left.grossWinnings) {
        return right.grossWinnings - left.grossWinnings;
      }

      if (right.exactHits !== left.exactHits) {
        return right.exactHits - left.exactHits;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });
}

export function upsertPrediction(
  predictions: Prediction[],
  nextPrediction: Prediction,
) {
  const existingIndex = predictions.findIndex(
    (prediction) =>
      prediction.userId === nextPrediction.userId &&
      prediction.gameId === nextPrediction.gameId,
  );

  if (existingIndex === -1) {
    return [...predictions, nextPrediction];
  }

  return predictions.map((prediction, index) =>
    index === existingIndex ? nextPrediction : prediction,
  );
}

export function upsertResult(results: MatchResult[], nextResult: MatchResult) {
  const existingIndex = results.findIndex(
    (result) => result.gameId === nextResult.gameId,
  );

  if (existingIndex === -1) {
    return [...results, nextResult];
  }

  return results.map((result, index) =>
    index === existingIndex ? nextResult : result,
  );
}

export function isGameReadyForPrediction(game: ResolvedGame) {
  return Boolean(game.homeTeam && game.awayTeam);
}

export function getPredictionAvailability(
  game: ResolvedGame,
  now = new Date(),
): PredictionAvailability {
  if (!isGameReadyForPrediction(game)) {
    return {
      status: "pending",
      message: "Aguardando definicao das duas selecoes",
    };
  }

  const kickoffTime = new Date(game.kickoff).getTime();
  const nowTime = now.getTime();
  const closesAt = kickoffTime - 60 * 1000;

  if (nowTime >= kickoffTime) {
    return {
      status: "locked",
      message: "Palpite encerrado. Jogo iniciado.",
    };
  }

  if (nowTime >= closesAt) {
    return {
      status: "locked",
      message: "Palpite travado 1 minuto antes do apito inicial.",
    };
  }

  return {
    status: "open",
    message: `Aberto ate ${formatFullDateTime(new Date(closesAt).toISOString())}`,
  };
}

export function getSpecialPickAvailability(
  firstKickoff: string,
  now = new Date(),
): PredictionAvailability {
  const firstKickoffTime = new Date(firstKickoff).getTime();
  const nowTime = now.getTime();

  if (nowTime >= firstKickoffTime) {
    return {
      status: "locked",
      message: "Campeao e artilheiro travados no apito inicial da Copa.",
    };
  }

  return {
    status: "open",
    message: `Aberto ate ${formatFullDateTime(firstKickoff)}`,
  };
}

export const scoringRules = [
  { label: "Pote de Resultado por usuario", value: 0.5 },
  { label: "Pote de Gols por usuario", value: 1.0 },
  { label: "Pote de Placar Exato por usuario", value: 1.5 },
  { label: "Investimento por jogo", value: 3.0 },
];

export const awardRules = [
  { label: "Mais placares cravados", prize: 20 },
  { label: "Acertou o campeao", prize: 30 },
  { label: "Acertou o artilheiro", prize: 5 },
];
