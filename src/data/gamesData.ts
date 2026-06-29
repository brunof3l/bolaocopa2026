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

// Nomes oficiais dos estadios (com a cidade-sede entre parenteses).
const venues = {
  azteca: "Estadio Azteca (Mexico City)",
  guadalajara: "Estadio Guadalajara",
  monterrey: "Estadio BBVA (Monterrey)",
  atlanta: "Mercedes-Benz Stadium (Atlanta)",
  miami: "Hard Rock Stadium (Miami)",
  toronto: "BMO Field (Toronto)",
  vancouver: "BC Place (Vancouver)",
  seattle: "Lumen Field (Seattle)",
  losAngeles: "SoFi Stadium (Los Angeles)",
  sanFrancisco: "Levi's Stadium (San Francisco)",
  nyNj: "MetLife Stadium (NY/NJ)",
  boston: "Gillette Stadium (Boston)",
  philadelphia: "Lincoln Financial Field (Philadelphia)",
  houston: "NRG Stadium (Houston)",
  dallas: "AT&T Stadium (Dallas)",
  kansasCity: "Arrowhead Stadium (Kansas City)",
} as const;

type GroupFixture = {
  homeTeamId: string;
  awayTeamId: string;
  // Horario em fuso de MS (UTC-4 / America/Campo_Grande). Calendario oficial
  // da Copa do Mundo 2026, com confrontos, datas e sedes reais de cada jogo.
  kickoff: string;
  stadium: string;
};

// Os 6 jogos de cada grupo na ordem cronologica oficial. As rodadas sao
// formadas a cada par de jogos (1-2 = Rodada 1, 3-4 = Rodada 2, 5-6 = Rodada 3).
const groupFixtures: Record<GroupId, GroupFixture[]> = {
  A: [
    { homeTeamId: "mexico", awayTeamId: "south-africa", kickoff: "2026-06-11T15:00:00-04:00", stadium: venues.azteca },
    { homeTeamId: "korea-republic", awayTeamId: "czechia", kickoff: "2026-06-11T22:00:00-04:00", stadium: venues.guadalajara },
    { homeTeamId: "czechia", awayTeamId: "south-africa", kickoff: "2026-06-18T12:00:00-04:00", stadium: venues.atlanta },
    { homeTeamId: "mexico", awayTeamId: "korea-republic", kickoff: "2026-06-18T21:00:00-04:00", stadium: venues.guadalajara },
    { homeTeamId: "czechia", awayTeamId: "mexico", kickoff: "2026-06-24T21:00:00-04:00", stadium: venues.azteca },
    { homeTeamId: "south-africa", awayTeamId: "korea-republic", kickoff: "2026-06-24T21:00:00-04:00", stadium: venues.monterrey },
  ],
  B: [
    { homeTeamId: "canada", awayTeamId: "bosnia", kickoff: "2026-06-12T15:00:00-04:00", stadium: venues.toronto },
    { homeTeamId: "qatar", awayTeamId: "switzerland", kickoff: "2026-06-13T15:00:00-04:00", stadium: venues.sanFrancisco },
    { homeTeamId: "switzerland", awayTeamId: "bosnia", kickoff: "2026-06-18T15:00:00-04:00", stadium: venues.losAngeles },
    { homeTeamId: "canada", awayTeamId: "qatar", kickoff: "2026-06-18T18:00:00-04:00", stadium: venues.vancouver },
    { homeTeamId: "switzerland", awayTeamId: "canada", kickoff: "2026-06-24T15:00:00-04:00", stadium: venues.vancouver },
    { homeTeamId: "bosnia", awayTeamId: "qatar", kickoff: "2026-06-24T15:00:00-04:00", stadium: venues.seattle },
  ],
  C: [
    { homeTeamId: "brazil", awayTeamId: "morocco", kickoff: "2026-06-13T18:00:00-04:00", stadium: venues.nyNj },
    { homeTeamId: "haiti", awayTeamId: "scotland", kickoff: "2026-06-13T21:00:00-04:00", stadium: venues.boston },
    { homeTeamId: "scotland", awayTeamId: "morocco", kickoff: "2026-06-19T18:00:00-04:00", stadium: venues.boston },
    { homeTeamId: "brazil", awayTeamId: "haiti", kickoff: "2026-06-19T20:30:00-04:00", stadium: venues.philadelphia },
    { homeTeamId: "scotland", awayTeamId: "brazil", kickoff: "2026-06-24T18:00:00-04:00", stadium: venues.miami },
    { homeTeamId: "morocco", awayTeamId: "haiti", kickoff: "2026-06-24T18:00:00-04:00", stadium: venues.atlanta },
  ],
  D: [
    { homeTeamId: "usa", awayTeamId: "paraguay", kickoff: "2026-06-12T21:00:00-04:00", stadium: venues.losAngeles },
    { homeTeamId: "australia", awayTeamId: "turkiye", kickoff: "2026-06-14T00:00:00-04:00", stadium: venues.vancouver },
    { homeTeamId: "usa", awayTeamId: "australia", kickoff: "2026-06-19T15:00:00-04:00", stadium: venues.seattle },
    { homeTeamId: "turkiye", awayTeamId: "paraguay", kickoff: "2026-06-19T23:00:00-04:00", stadium: venues.sanFrancisco },
    { homeTeamId: "turkiye", awayTeamId: "usa", kickoff: "2026-06-25T22:00:00-04:00", stadium: venues.losAngeles },
    { homeTeamId: "paraguay", awayTeamId: "australia", kickoff: "2026-06-25T22:00:00-04:00", stadium: venues.sanFrancisco },
  ],
  E: [
    { homeTeamId: "germany", awayTeamId: "curacao", kickoff: "2026-06-14T13:00:00-04:00", stadium: venues.houston },
    { homeTeamId: "ivory-coast", awayTeamId: "ecuador", kickoff: "2026-06-14T19:00:00-04:00", stadium: venues.philadelphia },
    { homeTeamId: "germany", awayTeamId: "ivory-coast", kickoff: "2026-06-20T16:00:00-04:00", stadium: venues.toronto },
    { homeTeamId: "ecuador", awayTeamId: "curacao", kickoff: "2026-06-20T20:00:00-04:00", stadium: venues.kansasCity },
    { homeTeamId: "curacao", awayTeamId: "ivory-coast", kickoff: "2026-06-25T16:00:00-04:00", stadium: venues.philadelphia },
    { homeTeamId: "ecuador", awayTeamId: "germany", kickoff: "2026-06-25T16:00:00-04:00", stadium: venues.nyNj },
  ],
  F: [
    { homeTeamId: "netherlands", awayTeamId: "japan", kickoff: "2026-06-14T16:00:00-04:00", stadium: venues.dallas },
    { homeTeamId: "sweden", awayTeamId: "tunisia", kickoff: "2026-06-14T22:00:00-04:00", stadium: venues.monterrey },
    { homeTeamId: "netherlands", awayTeamId: "sweden", kickoff: "2026-06-20T13:00:00-04:00", stadium: venues.houston },
    { homeTeamId: "tunisia", awayTeamId: "japan", kickoff: "2026-06-21T00:00:00-04:00", stadium: venues.monterrey },
    { homeTeamId: "japan", awayTeamId: "sweden", kickoff: "2026-06-25T19:00:00-04:00", stadium: venues.dallas },
    { homeTeamId: "tunisia", awayTeamId: "netherlands", kickoff: "2026-06-25T19:00:00-04:00", stadium: venues.kansasCity },
  ],
  G: [
    { homeTeamId: "belgium", awayTeamId: "egypt", kickoff: "2026-06-15T15:00:00-04:00", stadium: venues.seattle },
    { homeTeamId: "iran", awayTeamId: "new-zealand", kickoff: "2026-06-15T21:00:00-04:00", stadium: venues.losAngeles },
    { homeTeamId: "belgium", awayTeamId: "iran", kickoff: "2026-06-21T15:00:00-04:00", stadium: venues.losAngeles },
    { homeTeamId: "new-zealand", awayTeamId: "egypt", kickoff: "2026-06-21T21:00:00-04:00", stadium: venues.vancouver },
    { homeTeamId: "egypt", awayTeamId: "iran", kickoff: "2026-06-26T23:00:00-04:00", stadium: venues.seattle },
    { homeTeamId: "new-zealand", awayTeamId: "belgium", kickoff: "2026-06-26T23:00:00-04:00", stadium: venues.vancouver },
  ],
  H: [
    { homeTeamId: "spain", awayTeamId: "cape-verde", kickoff: "2026-06-15T12:00:00-04:00", stadium: venues.atlanta },
    { homeTeamId: "saudi-arabia", awayTeamId: "uruguay", kickoff: "2026-06-15T18:00:00-04:00", stadium: venues.miami },
    { homeTeamId: "spain", awayTeamId: "saudi-arabia", kickoff: "2026-06-21T12:00:00-04:00", stadium: venues.atlanta },
    { homeTeamId: "uruguay", awayTeamId: "cape-verde", kickoff: "2026-06-21T18:00:00-04:00", stadium: venues.miami },
    { homeTeamId: "cape-verde", awayTeamId: "saudi-arabia", kickoff: "2026-06-26T20:00:00-04:00", stadium: venues.houston },
    { homeTeamId: "uruguay", awayTeamId: "spain", kickoff: "2026-06-26T20:00:00-04:00", stadium: venues.guadalajara },
  ],
  I: [
    { homeTeamId: "france", awayTeamId: "senegal", kickoff: "2026-06-16T15:00:00-04:00", stadium: venues.nyNj },
    { homeTeamId: "iraq", awayTeamId: "norway", kickoff: "2026-06-16T18:00:00-04:00", stadium: venues.boston },
    { homeTeamId: "france", awayTeamId: "iraq", kickoff: "2026-06-22T17:00:00-04:00", stadium: venues.philadelphia },
    { homeTeamId: "norway", awayTeamId: "senegal", kickoff: "2026-06-22T20:00:00-04:00", stadium: venues.nyNj },
    { homeTeamId: "norway", awayTeamId: "france", kickoff: "2026-06-26T15:00:00-04:00", stadium: venues.boston },
    { homeTeamId: "senegal", awayTeamId: "iraq", kickoff: "2026-06-26T15:00:00-04:00", stadium: venues.toronto },
  ],
  J: [
    { homeTeamId: "argentina", awayTeamId: "algeria", kickoff: "2026-06-16T21:00:00-04:00", stadium: venues.kansasCity },
    { homeTeamId: "austria", awayTeamId: "jordan", kickoff: "2026-06-17T00:00:00-04:00", stadium: venues.sanFrancisco },
    { homeTeamId: "argentina", awayTeamId: "austria", kickoff: "2026-06-22T13:00:00-04:00", stadium: venues.dallas },
    { homeTeamId: "jordan", awayTeamId: "algeria", kickoff: "2026-06-22T23:00:00-04:00", stadium: venues.sanFrancisco },
    { homeTeamId: "algeria", awayTeamId: "austria", kickoff: "2026-06-27T22:00:00-04:00", stadium: venues.kansasCity },
    { homeTeamId: "jordan", awayTeamId: "argentina", kickoff: "2026-06-27T22:00:00-04:00", stadium: venues.dallas },
  ],
  K: [
    { homeTeamId: "portugal", awayTeamId: "dr-congo", kickoff: "2026-06-17T13:00:00-04:00", stadium: venues.houston },
    { homeTeamId: "uzbekistan", awayTeamId: "colombia", kickoff: "2026-06-17T22:00:00-04:00", stadium: venues.azteca },
    { homeTeamId: "portugal", awayTeamId: "uzbekistan", kickoff: "2026-06-23T13:00:00-04:00", stadium: venues.houston },
    { homeTeamId: "colombia", awayTeamId: "dr-congo", kickoff: "2026-06-23T22:00:00-04:00", stadium: venues.guadalajara },
    { homeTeamId: "colombia", awayTeamId: "portugal", kickoff: "2026-06-27T19:30:00-04:00", stadium: venues.miami },
    { homeTeamId: "dr-congo", awayTeamId: "uzbekistan", kickoff: "2026-06-27T19:30:00-04:00", stadium: venues.atlanta },
  ],
  L: [
    { homeTeamId: "england", awayTeamId: "croatia", kickoff: "2026-06-17T16:00:00-04:00", stadium: venues.dallas },
    { homeTeamId: "ghana", awayTeamId: "panama", kickoff: "2026-06-17T19:00:00-04:00", stadium: venues.toronto },
    { homeTeamId: "england", awayTeamId: "ghana", kickoff: "2026-06-23T16:00:00-04:00", stadium: venues.boston },
    { homeTeamId: "panama", awayTeamId: "croatia", kickoff: "2026-06-23T19:00:00-04:00", stadium: venues.toronto },
    { homeTeamId: "panama", awayTeamId: "england", kickoff: "2026-06-27T17:00:00-04:00", stadium: venues.nyNj },
    { homeTeamId: "croatia", awayTeamId: "ghana", kickoff: "2026-06-27T17:00:00-04:00", stadium: venues.philadelphia },
  ],
};

function createGroupGames(group: GroupDefinition, startMatchNumber: number) {
  return groupFixtures[group.id].map((fixture, index) => ({
    id: `match-${String(startMatchNumber + index).padStart(3, "0")}`,
    matchNumber: startMatchNumber + index,
    stage: "group" as const,
    roundLabel: "Fase de grupos",
    matchdayLabel: `Grupo ${group.id} - Rodada ${Math.floor(index / 2) + 1}`,
    kickoff: fixture.kickoff,
    stadium: fixture.stadium,
    groupId: group.id,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
  }));
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

function createR32Game(
  matchNumber: number,
  matchdayLabel: string,
  kickoffValue: string,
  stadium: string,
  homeTeamId: string,
  awayTeamId: string,
): Game {
  return {
    id: `match-${String(matchNumber).padStart(3, "0")}`,
    matchNumber,
    stage: "round_of_32",
    roundLabel: "16 avos de final",
    matchdayLabel,
    kickoff: kickoffValue,
    stadium,
    homeTeamId,
    awayTeamId,
  };
}

const knockoutGames: Game[] = [
  // 16 avos de final — confrontos definidos, datas/horarios em fuso de MS
  // (UTC-4) e sedes reais. Numero do jogo segue o chaveamento oficial.
  createR32Game(73, "16 avos - Jogo 1", "2026-06-28T15:00:00-04:00", venues.losAngeles, "south-africa", "canada"),
  createR32Game(74, "16 avos - Jogo 2", "2026-06-29T16:30:00-04:00", venues.boston, "germany", "paraguay"),
  createR32Game(75, "16 avos - Jogo 3", "2026-06-29T21:00:00-04:00", venues.monterrey, "netherlands", "morocco"),
  createR32Game(76, "16 avos - Jogo 4", "2026-06-29T13:00:00-04:00", venues.houston, "brazil", "japan"),
  createR32Game(77, "16 avos - Jogo 5", "2026-06-30T17:00:00-04:00", venues.nyNj, "france", "sweden"),
  createR32Game(78, "16 avos - Jogo 6", "2026-06-30T13:00:00-04:00", venues.dallas, "ivory-coast", "norway"),
  createR32Game(79, "16 avos - Jogo 7", "2026-06-30T21:00:00-04:00", venues.azteca, "mexico", "ecuador"),
  createR32Game(80, "16 avos - Jogo 8", "2026-07-01T12:00:00-04:00", venues.atlanta, "england", "dr-congo"),
  createR32Game(81, "16 avos - Jogo 9", "2026-07-01T20:00:00-04:00", venues.sanFrancisco, "usa", "bosnia"),
  createR32Game(82, "16 avos - Jogo 10", "2026-07-01T16:00:00-04:00", venues.seattle, "belgium", "senegal"),
  createR32Game(83, "16 avos - Jogo 11", "2026-07-02T19:00:00-04:00", venues.toronto, "portugal", "croatia"),
  createR32Game(84, "16 avos - Jogo 12", "2026-07-02T15:00:00-04:00", venues.losAngeles, "spain", "austria"),
  createR32Game(85, "16 avos - Jogo 13", "2026-07-02T23:00:00-04:00", venues.vancouver, "switzerland", "algeria"),
  createR32Game(86, "16 avos - Jogo 14", "2026-07-03T18:00:00-04:00", venues.miami, "argentina", "cape-verde"),
  createR32Game(87, "16 avos - Jogo 15", "2026-07-03T21:30:00-04:00", venues.kansasCity, "colombia", "ghana"),
  createR32Game(88, "16 avos - Jogo 16", "2026-07-03T14:00:00-04:00", venues.dallas, "australia", "egypt"),
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
