import type {
  Game,
  GroupDefinition,
  GroupId,
  Participant,
  Team,
  TournamentStage,
} from "@/types/bolao";

export const participants: Participant[] = [
  { id: "bruno", name: "Bruno", accentColor: "#10b981", role: "admin" },
  { id: "edivaldo", name: "Edivaldo", accentColor: "#0ea5e9", role: "user" },
  { id: "eduardo", name: "Eduardo", accentColor: "#a855f7", role: "user" },
  { id: "fernandinho", name: "Fernandinho", accentColor: "#f59e0b", role: "user" },
  { id: "gabriel", name: "Gabriel", accentColor: "#f43f5e", role: "user" },
  { id: "geovane", name: "Geovane", accentColor: "#3b82f6", role: "user" },
  { id: "gustavo", name: "Gustavo", accentColor: "#84cc16", role: "user" },
  { id: "sidnei", name: "Sidnei", accentColor: "#ef4444", role: "user" },
  { id: "sidnei-jr", name: "Sidnei Jr", accentColor: "#8b5cf6", role: "user" },
];

function team(
  id: string,
  code: string,
  name: string,
  shortName: string,
  groupId: GroupId,
  isPlaceholder = false,
): Team {
  return { id, code, name, shortName, groupId, isPlaceholder };
}

export const groupsData: GroupDefinition[] = [
  {
    id: "A",
    name: "Grupo A",
    teams: [
      team("mexico", "MX", "Mexico", "Mexico", "A"),
      team("korea-republic", "KR", "Coreia do Sul", "Coreia do Sul", "A"),
      team("czechia", "CZ", "Republica Tcheca", "Tchequia", "A"),
      team("south-africa", "ZA", "Africa do Sul", "Africa do Sul", "A"),
    ],
  },
  {
    id: "B",
    name: "Grupo B",
    teams: [
      team("canada", "CA", "Canada", "Canada", "B"),
      team("qatar", "QA", "Catar", "Catar", "B"),
      team("switzerland", "CH", "Suica", "Suica", "B"),
      team("bosnia", "BA", "Bosnia e Herzegovina", "Bosnia", "B"),
    ],
  },
  {
    id: "C",
    name: "Grupo C",
    teams: [
      team("brazil", "BR", "Brasil", "Brasil", "C"),
      team("haiti", "HT", "Haiti", "Haiti", "C"),
      team("scotland", "SC", "Escocia", "Escocia", "C"),
      team("morocco", "MA", "Marrocos", "Marrocos", "C"),
    ],
  },
  {
    id: "D",
    name: "Grupo D",
    teams: [
      team("usa", "US", "Estados Unidos", "EUA", "D"),
      team("australia", "AU", "Australia", "Australia", "D"),
      team("turkiye", "TR", "Turquia", "Turquia", "D"),
      team("paraguay", "PY", "Paraguai", "Paraguai", "D"),
    ],
  },
  {
    id: "E",
    name: "Grupo E",
    teams: [
      team("germany", "DE", "Alemanha", "Alemanha", "E"),
      team("ivory-coast", "CI", "Costa do Marfim", "Costa do Marfim", "E"),
      team("ecuador", "EC", "Equador", "Equador", "E"),
      team("curacao", "CW", "Curacao", "Curacao", "E", true),
    ],
  },
  {
    id: "F",
    name: "Grupo F",
    teams: [
      team("netherlands", "NL", "Holanda", "Holanda", "F"),
      team("sweden", "SE", "Suecia", "Suecia", "F"),
      team("tunisia", "TN", "Tunisia", "Tunisia", "F"),
      team("japan", "JP", "Japao", "Japao", "F"),
    ],
  },
  {
    id: "G",
    name: "Grupo G",
    teams: [
      team("belgium", "BE", "Belgica", "Belgica", "G"),
      team("iran", "IR", "Ira", "Ira", "G"),
      team("new-zealand", "NZ", "Nova Zelandia", "Nova Zelandia", "G"),
      team("egypt", "EG", "Egito", "Egito", "G"),
    ],
  },
  {
    id: "H",
    name: "Grupo H",
    teams: [
      team("spain", "ES", "Espanha", "Espanha", "H"),
      team("saudi-arabia", "SA", "Arabia Saudita", "Arabia Saudita", "H"),
      team("uruguay", "UY", "Uruguai", "Uruguai", "H"),
      team("cape-verde", "CV", "Cabo Verde", "Cabo Verde", "H", true),
    ],
  },
  {
    id: "I",
    name: "Grupo I",
    teams: [
      team("france", "FR", "Franca", "Franca", "I"),
      team("iraq", "IQ", "Iraque", "Iraque", "I"),
      team("norway", "NO", "Noruega", "Noruega", "I"),
      team("senegal", "SN", "Senegal", "Senegal", "I"),
    ],
  },
  {
    id: "J",
    name: "Grupo J",
    teams: [
      team("argentina", "AR", "Argentina", "Argentina", "J"),
      team("austria", "AT", "Austria", "Austria", "J"),
      team("jordan", "JO", "Jordania", "Jordania", "J", true),
      team("algeria", "DZ", "Argelia", "Argelia", "J"),
    ],
  },
  {
    id: "K",
    name: "Grupo K",
    teams: [
      team("portugal", "PT", "Portugal", "Portugal", "K"),
      team("uzbekistan", "UZ", "Uzbequistao", "Uzbequistao", "K", true),
      team("colombia", "CO", "Colombia", "Colombia", "K"),
      team("dr-congo", "CD", "RD Congo", "RD Congo", "K"),
    ],
  },
  {
    id: "L",
    name: "Grupo L",
    teams: [
      team("england", "GB", "Inglaterra", "Inglaterra", "L"),
      team("ghana", "GH", "Gana", "Gana", "L"),
      team("panama", "PA", "Panama", "Panama", "L"),
      team("croatia", "HR", "Croacia", "Croacia", "L"),
    ],
  },
];

export const teams = groupsData.flatMap((group) => group.teams);

export const teamsById = Object.fromEntries(
  teams.map((currentTeam) => [currentTeam.id, currentTeam] as const),
);

// Todos os horários em fuso de MS (UTC-4 / America/Campo_Grande).
// Formato: YYYY-MM-DDTHH:MM:00-04:00
// kickoffs[rodada][jogo] — rodada 0..2, jogo 0..1
const groupCalendar: Record<
  GroupId,
  {
    kickoffs: [[string, string], [string, string], [string, string]];
    stadiums: [string, string];
  }
> = {
  A: {
    kickoffs: [
      ["2026-06-11T15:00:00-04:00", "2026-06-11T22:00:00-04:00"],
      ["2026-06-18T12:00:00-04:00", "2026-06-18T21:00:00-04:00"],
      ["2026-06-24T21:00:00-04:00", "2026-06-24T21:00:00-04:00"],
    ],
    stadiums: ["Estadio Azteca", "Estadio Guadalajara"],
  },
  B: {
    kickoffs: [
      ["2026-06-12T15:00:00-04:00", "2026-06-13T15:00:00-04:00"],
      ["2026-06-18T15:00:00-04:00", "2026-06-18T18:00:00-04:00"],
      ["2026-06-24T15:00:00-04:00", "2026-06-24T15:00:00-04:00"],
    ],
    stadiums: ["BMO Field (Toronto)", "BC Place (Vancouver)"],
  },
  C: {
    kickoffs: [
      ["2026-06-13T18:00:00-04:00", "2026-06-13T21:00:00-04:00"],
      ["2026-06-19T18:00:00-04:00", "2026-06-19T20:30:00-04:00"],
      ["2026-06-24T18:00:00-04:00", "2026-06-24T18:00:00-04:00"],
    ],
    stadiums: ["MetLife Stadium (NY/NJ)", "Gillette Stadium (Boston)"],
  },
  D: {
    kickoffs: [
      ["2026-06-12T21:00:00-04:00", "2026-06-14T00:00:00-04:00"],
      ["2026-06-19T15:00:00-04:00", "2026-06-19T23:00:00-04:00"],
      ["2026-06-25T22:00:00-04:00", "2026-06-25T22:00:00-04:00"],
    ],
    stadiums: ["SoFi Stadium (Los Angeles)", "Lumen Field (Seattle)"],
  },
  E: {
    kickoffs: [
      ["2026-06-14T13:00:00-04:00", "2026-06-14T19:00:00-04:00"],
      ["2026-06-20T16:00:00-04:00", "2026-06-20T20:00:00-04:00"],
      ["2026-06-25T16:00:00-04:00", "2026-06-25T16:00:00-04:00"],
    ],
    stadiums: ["NRG Stadium (Houston)", "Lincoln Financial Field (Philadelphia)"],
  },
  F: {
    kickoffs: [
      ["2026-06-14T16:00:00-04:00", "2026-06-14T22:00:00-04:00"],
      ["2026-06-20T13:00:00-04:00", "2026-06-21T00:00:00-04:00"],
      ["2026-06-25T19:00:00-04:00", "2026-06-25T19:00:00-04:00"],
    ],
    stadiums: ["AT&T Stadium (Dallas)", "Estadio BBVA (Monterrey)"],
  },
  G: {
    kickoffs: [
      ["2026-06-15T15:00:00-04:00", "2026-06-15T21:00:00-04:00"],
      ["2026-06-21T15:00:00-04:00", "2026-06-21T21:00:00-04:00"],
      ["2026-06-26T23:00:00-04:00", "2026-06-26T23:00:00-04:00"],
    ],
    stadiums: ["Lumen Field (Seattle)", "SoFi Stadium (Los Angeles)"],
  },
  H: {
    kickoffs: [
      ["2026-06-15T12:00:00-04:00", "2026-06-15T18:00:00-04:00"],
      ["2026-06-21T12:00:00-04:00", "2026-06-21T18:00:00-04:00"],
      ["2026-06-26T20:00:00-04:00", "2026-06-26T20:00:00-04:00"],
    ],
    stadiums: ["Mercedes-Benz Stadium (Atlanta)", "Hard Rock Stadium (Miami)"],
  },
  I: {
    kickoffs: [
      ["2026-06-16T15:00:00-04:00", "2026-06-16T18:00:00-04:00"],
      ["2026-06-22T17:00:00-04:00", "2026-06-22T20:00:00-04:00"],
      ["2026-06-26T15:00:00-04:00", "2026-06-26T15:00:00-04:00"],
    ],
    stadiums: ["MetLife Stadium (NY/NJ)", "Gillette Stadium (Boston)"],
  },
  J: {
    kickoffs: [
      ["2026-06-16T21:00:00-04:00", "2026-06-17T00:00:00-04:00"],
      ["2026-06-22T13:00:00-04:00", "2026-06-22T23:00:00-04:00"],
      ["2026-06-27T22:00:00-04:00", "2026-06-27T22:00:00-04:00"],
    ],
    stadiums: ["Arrowhead Stadium (Kansas City)", "Levi's Stadium (San Francisco)"],
  },
  K: {
    kickoffs: [
      ["2026-06-17T13:00:00-04:00", "2026-06-17T22:00:00-04:00"],
      ["2026-06-23T13:00:00-04:00", "2026-06-23T22:00:00-04:00"],
      ["2026-06-27T19:30:00-04:00", "2026-06-27T19:30:00-04:00"],
    ],
    stadiums: ["NRG Stadium (Houston)", "Estadio Azteca (Mexico City)"],
  },
  L: {
    kickoffs: [
      ["2026-06-17T16:00:00-04:00", "2026-06-17T19:00:00-04:00"],
      ["2026-06-23T16:00:00-04:00", "2026-06-23T19:00:00-04:00"],
      ["2026-06-27T17:00:00-04:00", "2026-06-27T17:00:00-04:00"],
    ],
    stadiums: ["AT&T Stadium (Dallas)", "BMO Field (Toronto)"],
  },
};

function createGroupGames(group: GroupDefinition, startMatchNumber: number) {
  const [team1, team2, team3, team4] = group.teams;
  const calendar = groupCalendar[group.id];

  const pairings = [
    [
      { homeTeamId: team1.id, awayTeamId: team4.id },
      { homeTeamId: team2.id, awayTeamId: team3.id },
    ],
    [
      { homeTeamId: team1.id, awayTeamId: team3.id },
      { homeTeamId: team4.id, awayTeamId: team2.id },
    ],
    [
      { homeTeamId: team1.id, awayTeamId: team2.id },
      { homeTeamId: team3.id, awayTeamId: team4.id },
    ],
  ] as const;

  return pairings.flatMap((matchdayGames, matchdayIndex) => {
    return matchdayGames.map((pairing, gameIndex) => ({
      id: `match-${String(startMatchNumber + matchdayIndex * 2 + gameIndex).padStart(3, "0")}`,
      matchNumber: startMatchNumber + matchdayIndex * 2 + gameIndex,
      stage: "group" as const,
      roundLabel: "Fase de grupos",
      matchdayLabel: `Grupo ${group.id} - Rodada ${matchdayIndex + 1}`,
      kickoff: calendar.kickoffs[matchdayIndex][gameIndex],
      stadium: calendar.stadiums[gameIndex],
      groupId: group.id,
      homeTeamId: pairing.homeTeamId,
      awayTeamId: pairing.awayTeamId,
    }));
  });
}

function createKnockoutGame(
  matchNumber: number,
  stage: TournamentStage,
  roundLabel: string,
  matchdayLabel: string,
  kickoffValue: string,
  stadium: string,
  homeSource: Game["homeSource"],
  awaySource: Game["awaySource"],
): Game {
  return {
    id: `match-${String(matchNumber).padStart(3, "0")}`,
    matchNumber,
    stage,
    roundLabel,
    matchdayLabel,
    kickoff: kickoffValue,
    stadium,
    homeTeamId: null,
    awayTeamId: null,
    homeSource,
    awaySource,
  };
}

const groupStageGames = groupsData.flatMap((group, index) =>
  createGroupGames(group, index * 6 + 1),
);

const knockoutGames: Game[] = [
  createKnockoutGame(
    73,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 1",
    "2026-06-28T15:00:00-04:00",
    "SoFi Stadium (Los Angeles)",
    { type: "group_position", groupId: "A", position: 2 },
    { type: "group_position", groupId: "B", position: 2 },
  ),
  createKnockoutGame(
    74,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 2",
    "2026-06-29T15:00:00-04:00",
    "Gillette Stadium (Boston)",
    { type: "group_position", groupId: "E", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-74",
      candidateGroups: ["A", "B", "C", "D", "F"],
    },
  ),
  createKnockoutGame(
    75,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 3",
    "2026-06-29T19:00:00-04:00",
    "Estadio BBVA (Monterrey)",
    { type: "group_position", groupId: "F", position: 1 },
    { type: "group_position", groupId: "C", position: 2 },
  ),
  createKnockoutGame(
    76,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 4",
    "2026-06-29T22:00:00-04:00",
    "NRG Stadium (Houston)",
    { type: "group_position", groupId: "C", position: 1 },
    { type: "group_position", groupId: "F", position: 2 },
  ),
  createKnockoutGame(
    77,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 5",
    "2026-06-30T15:00:00-04:00",
    "MetLife Stadium (NY/NJ)",
    { type: "group_position", groupId: "I", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-77",
      candidateGroups: ["C", "D", "F", "G", "H"],
    },
  ),
  createKnockoutGame(
    78,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 6",
    "2026-06-30T19:00:00-04:00",
    "AT&T Stadium (Dallas)",
    { type: "group_position", groupId: "E", position: 2 },
    { type: "group_position", groupId: "I", position: 2 },
  ),
  createKnockoutGame(
    79,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 7",
    "2026-06-30T22:00:00-04:00",
    "Estadio Azteca (Mexico City)",
    { type: "group_position", groupId: "A", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-79",
      candidateGroups: ["C", "E", "F", "H", "I"],
    },
  ),
  createKnockoutGame(
    80,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 8",
    "2026-07-01T15:00:00-04:00",
    "Mercedes-Benz Stadium (Atlanta)",
    { type: "group_position", groupId: "L", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-80",
      candidateGroups: ["E", "H", "I", "J", "K"],
    },
  ),
  createKnockoutGame(
    81,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 9",
    "2026-07-01T19:00:00-04:00",
    "Levi's Stadium (San Francisco)",
    { type: "group_position", groupId: "D", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-81",
      candidateGroups: ["B", "E", "F", "I", "J"],
    },
  ),
  createKnockoutGame(
    82,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 10",
    "2026-07-01T22:00:00-04:00",
    "Lumen Field (Seattle)",
    { type: "group_position", groupId: "G", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-82",
      candidateGroups: ["A", "E", "H", "I", "J"],
    },
  ),
  createKnockoutGame(
    83,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 11",
    "2026-07-02T15:00:00-04:00",
    "BMO Field (Toronto)",
    { type: "group_position", groupId: "K", position: 2 },
    { type: "group_position", groupId: "L", position: 2 },
  ),
  createKnockoutGame(
    84,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 12",
    "2026-07-02T19:00:00-04:00",
    "SoFi Stadium (Los Angeles)",
    { type: "group_position", groupId: "H", position: 1 },
    { type: "group_position", groupId: "J", position: 2 },
  ),
  createKnockoutGame(
    85,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 13",
    "2026-07-02T22:00:00-04:00",
    "BC Place (Vancouver)",
    { type: "group_position", groupId: "B", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-85",
      candidateGroups: ["E", "F", "G", "I", "J"],
    },
  ),
  createKnockoutGame(
    86,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 14",
    "2026-07-03T15:00:00-04:00",
    "Hard Rock Stadium (Miami)",
    { type: "group_position", groupId: "J", position: 1 },
    { type: "group_position", groupId: "H", position: 2 },
  ),
  createKnockoutGame(
    87,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 15",
    "2026-07-03T19:00:00-04:00",
    "Arrowhead Stadium (Kansas City)",
    { type: "group_position", groupId: "K", position: 1 },
    {
      type: "best_third",
      slotId: "r32-slot-87",
      candidateGroups: ["D", "E", "I", "J", "L"],
    },
  ),
  createKnockoutGame(
    88,
    "round_of_32",
    "16 avos de final",
    "16 avos - Jogo 16",
    "2026-07-03T22:00:00-04:00",
    "AT&T Stadium (Dallas)",
    { type: "group_position", groupId: "D", position: 2 },
    { type: "group_position", groupId: "G", position: 2 },
  ),
  createKnockoutGame(
    89,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 1",
    "2026-07-04T15:00:00-04:00",
    "Lincoln Financial Field (Philadelphia)",
    { type: "winner", matchId: "match-074" },
    { type: "winner", matchId: "match-077" },
  ),
  createKnockoutGame(
    90,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 2",
    "2026-07-04T19:00:00-04:00",
    "NRG Stadium (Houston)",
    { type: "winner", matchId: "match-073" },
    { type: "winner", matchId: "match-075" },
  ),
  createKnockoutGame(
    91,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 3",
    "2026-07-05T15:00:00-04:00",
    "MetLife Stadium (NY/NJ)",
    { type: "winner", matchId: "match-076" },
    { type: "winner", matchId: "match-078" },
  ),
  createKnockoutGame(
    92,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 4",
    "2026-07-05T19:00:00-04:00",
    "Estadio Azteca (Mexico City)",
    { type: "winner", matchId: "match-079" },
    { type: "winner", matchId: "match-080" },
  ),
  createKnockoutGame(
    93,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 5",
    "2026-07-06T15:00:00-04:00",
    "AT&T Stadium (Dallas)",
    { type: "winner", matchId: "match-083" },
    { type: "winner", matchId: "match-084" },
  ),
  createKnockoutGame(
    94,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 6",
    "2026-07-06T19:00:00-04:00",
    "Lumen Field (Seattle)",
    { type: "winner", matchId: "match-081" },
    { type: "winner", matchId: "match-082" },
  ),
  createKnockoutGame(
    95,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 7",
    "2026-07-07T15:00:00-04:00",
    "Mercedes-Benz Stadium (Atlanta)",
    { type: "winner", matchId: "match-086" },
    { type: "winner", matchId: "match-088" },
  ),
  createKnockoutGame(
    96,
    "round_of_16",
    "Oitavas de final",
    "Oitavas - Jogo 8",
    "2026-07-07T19:00:00-04:00",
    "BC Place (Vancouver)",
    { type: "winner", matchId: "match-085" },
    { type: "winner", matchId: "match-087" },
  ),
  createKnockoutGame(
    97,
    "quarterfinal",
    "Quartas de final",
    "Quartas - Jogo 1",
    "2026-07-09T15:00:00-04:00",
    "Gillette Stadium (Boston)",
    { type: "winner", matchId: "match-089" },
    { type: "winner", matchId: "match-090" },
  ),
  createKnockoutGame(
    98,
    "quarterfinal",
    "Quartas de final",
    "Quartas - Jogo 2",
    "2026-07-10T15:00:00-04:00",
    "SoFi Stadium (Los Angeles)",
    { type: "winner", matchId: "match-093" },
    { type: "winner", matchId: "match-094" },
  ),
  createKnockoutGame(
    99,
    "quarterfinal",
    "Quartas de final",
    "Quartas - Jogo 3",
    "2026-07-11T15:00:00-04:00",
    "Hard Rock Stadium (Miami)",
    { type: "winner", matchId: "match-091" },
    { type: "winner", matchId: "match-092" },
  ),
  createKnockoutGame(
    100,
    "quarterfinal",
    "Quartas de final",
    "Quartas - Jogo 4",
    "2026-07-11T19:00:00-04:00",
    "Arrowhead Stadium (Kansas City)",
    { type: "winner", matchId: "match-095" },
    { type: "winner", matchId: "match-096" },
  ),
  createKnockoutGame(
    101,
    "semifinal",
    "Semifinal",
    "Semifinal - Jogo 1",
    "2026-07-14T15:00:00-04:00",
    "AT&T Stadium (Dallas)",
    { type: "winner", matchId: "match-097" },
    { type: "winner", matchId: "match-098" },
  ),
  createKnockoutGame(
    102,
    "semifinal",
    "Semifinal",
    "Semifinal - Jogo 2",
    "2026-07-15T15:00:00-04:00",
    "Mercedes-Benz Stadium (Atlanta)",
    { type: "winner", matchId: "match-099" },
    { type: "winner", matchId: "match-100" },
  ),
  createKnockoutGame(
    103,
    "third_place",
    "Disputa do terceiro lugar",
    "Terceiro lugar",
    "2026-07-18T15:00:00-04:00",
    "Hard Rock Stadium (Miami)",
    { type: "loser", matchId: "match-101" },
    { type: "loser", matchId: "match-102" },
  ),
  createKnockoutGame(
    104,
    "final",
    "Final",
    "Grande final",
    "2026-07-19T15:00:00-04:00",
    "MetLife Stadium (NY/NJ)",
    { type: "winner", matchId: "match-101" },
    { type: "winner", matchId: "match-102" },
  ),
];

export const gamesData: Game[] = [...groupStageGames, ...knockoutGames];

export const stageOrder: TournamentStage[] = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];
