import type {
  AppState,
  Game,
  MatchResult,
  Participant,
  PredictionAvailability,
  Prediction,
  PredictionReward,
  RankingEntry,
  ResolvedGame,
  SpecialPick,
} from "@/types/bolao";
import { calculatePredictionReward } from "@/lib/tournamentEngine";

const EXACT_HIT_PRIZE = 20;
const CHAMPION_PRIZE = 30;
const TOP_SCORER_PRIZE = 5;

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
) : PredictionReward {
  return calculatePredictionReward(prediction, result);
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
  const finishedResults = new Map(
    state.results.map((result) => [result.gameId, result] as const),
  );

  const entries = participants.map((participant) => {
    let balance = 0;
    let exactHits = 0;
    let resultHits = 0;

    for (const game of games) {
      const prediction = getPrediction(state.predictions, participant.id, game.id);
      const result = finishedResults.get(game.id);
      const reward = getPredictionReward(prediction, result);

      balance += reward.amount;
      exactHits += Number(reward.exactHit);
      resultHits += Number(reward.resultHit);
    }

    const pick = getSpecialPick(state.specialPicks, participant.id);
    const championHit =
      Boolean(state.awards.champion) && pick?.champion === state.awards.champion;
    const topScorerHit =
      Boolean(state.awards.topScorer) && pick?.topScorer === state.awards.topScorer;

    return {
      userId: participant.id,
      name: participant.name,
      balance,
      exactHits,
      resultHits,
      championHit,
      topScorerHit,
      paidAwardsTotal:
        (championHit ? CHAMPION_PRIZE : 0) +
        (topScorerHit ? TOP_SCORER_PRIZE : 0),
    };
  });

  const maxExactHits = Math.max(...entries.map((entry) => entry.exactHits), 0);

  return entries
    .map((entry) => ({
      ...entry,
      paidAwardsTotal:
        entry.paidAwardsTotal +
        (maxExactHits > 0 && entry.exactHits === maxExactHits ? EXACT_HIT_PRIZE : 0),
    }))
    .sort((left, right) => {
      if (right.balance !== left.balance) {
        return right.balance - left.balance;
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
  const opensAt = kickoffTime - 48 * 60 * 60 * 1000;
  const isFirstRoundGroupGame =
    game.stage === "group" && game.matchdayLabel.endsWith("Rodada 1");

  if (nowTime >= kickoffTime) {
    return {
      status: "locked",
      message: "Palpite encerrado. Jogo iniciado.",
    };
  }

  if (isFirstRoundGroupGame) {
    return {
      status: "open",
      message: "Excecao da 1a rodada: aberto ate o apito inicial",
    };
  }

  if (nowTime < opensAt) {
    return {
      status: "pending",
      message: `Abre em ${formatFullDateTime(new Date(opensAt).toISOString())}`,
    };
  }

  return {
    status: "open",
    message: "Janela de palpite aberta",
  };
}

export const scoringRules = [
  { label: "Acertou resultado (1x2)", value: 0.5 },
  { label: "Acertou gols de uma equipe", value: 1.0 },
  { label: "Cravou o placar exato", value: 1.5 },
  { label: "Maximo por jogo", value: 3.0 },
];

export const awardRules = [
  { label: "Mais placares cravados", prize: EXACT_HIT_PRIZE },
  { label: "Acertou o campeao", prize: CHAMPION_PRIZE },
  { label: "Acertou o artilheiro", prize: TOP_SCORER_PRIZE },
];
