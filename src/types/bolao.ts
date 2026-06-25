export type MatchOutcome = "home" | "away" | "draw";

export type GroupId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type TournamentStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export type Team = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  groupId?: GroupId;
  isPlaceholder?: boolean;
};

export type GroupDefinition = {
  id: GroupId;
  name: string;
  teams: Team[];
};

export type Participant = {
  id: string;
  name: string;
  accentColor: string;
  role: AppUserRole;
};

export type AppUserRole = "admin" | "moderator" | "user";

export type TeamSlotSource =
  | {
      type: "group_position";
      groupId: GroupId;
      position: 1 | 2;
    }
  | {
      type: "best_third";
      slotId: string;
      candidateGroups: GroupId[];
    }
  | {
      type: "winner";
      matchId: string;
    }
  | {
      type: "loser";
      matchId: string;
    };

export type Game = {
  id: string;
  matchNumber: number;
  stage: TournamentStage;
  roundLabel: string;
  matchdayLabel: string;
  kickoff: string;
  stadium: string;
  groupId?: GroupId;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeSource?: TeamSlotSource;
  awaySource?: TeamSlotSource;
};

export type ResolvedGame = Game & {
  homeTeam: Team | null;
  awayTeam: Team | null;
};

export type Prediction = {
  userId: string;
  gameId: string;
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: string;
};

export type SpecialPick = {
  userId: string;
  champion: string;
  topScorer: string;
  updatedAt?: string;
};

export type MatchResult = {
  gameId: string;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
  // Momento em que o jogo foi encerrado (ISO). Usado para ordenar o acumulado
  // entre jogos do mesmo horario pela ordem real de encerramento.
  finishedAt?: string | null;
};

export type OfficialAwards = {
  champion: string | null;
  topScorer: string | null;
};

export type AppState = {
  predictions: Prediction[];
  specialPicks: SpecialPick[];
  results: MatchResult[];
  awards: OfficialAwards;
};

export type RankingEntry = {
  userId: string;
  name: string;
  grossWinnings: number;
  matchWinnings: number;
  finalAwardsWinnings: number;
  netSettlement: number;
  exactHits: number;
  resultHits: number;
  championHit: boolean;
  topScorerHit: boolean;
  championAward: number;
  topScorerAward: number;
  exactHitsAward: number;
  settlementLabel: "A Receber" | "A Pagar" | "Zerado";
};

export type StandingEntry = {
  groupId: GroupId;
  position: number;
  teamId: string;
  team: Team;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type BestThirdEntry = StandingEntry & {
  thirdPlaceRank: number;
};

export type KnockoutSlotAssignment = Record<string, GroupId>;

export type PredictionAvailability =
  | {
      status: "open";
      message: string;
    }
  | {
      status: "pending";
      message: string;
    }
  | {
      status: "locked";
      message: string;
    };

export type PredictionReward = {
  amount: number;
  resultHit: boolean;
  goalsHit: boolean;
  exactHit: boolean;
  resultAmount: number;
  goalsAmount: number;
  exactAmount: number;
};

export type SharedPot = {
  result: number;
  goals: number;
  exact: number;
};

export type MatchPoolBreakdown = {
  gameId: string;
  winners: {
    result: string[];
    goals: string[];
    exact: string[];
  };
  incomingRollover: SharedPot;
  basePot: SharedPot;
  totalPot: SharedPot;
  payoutPerWinner: SharedPot;
  distributed: SharedPot;
  rolloverOut: SharedPot;
  earningsByUser: Record<string, number>;
};

export type FinalAwardBreakdown = {
  championWinners: string[];
  championAwardPerWinner: number;
  championPot: number;
  exactHitsWinners: string[];
  exactHitsAwardPerWinner: number;
  exactHitsPot: number;
  topScorerWinners: string[];
  topScorerAwardPerWinner: number;
  topScorerPot: number;
};

export type TournamentFinanceSummary = {
  participantCount: number;
  matchBreakdowns: Record<string, MatchPoolBreakdown>;
  winningsByUser: Record<string, number>;
  exactHitsByUser: Record<string, number>;
  resultHitsByUser: Record<string, number>;
  finalAwards: FinalAwardBreakdown;
};
