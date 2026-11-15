export type GardenPlotState = 'ready' | 'growing' | 'locked' | 'empty';

export interface DashboardGardenPlotData {
  id: number | string;
  slot: number;
  state: GardenPlotState;
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  statusText?: string;
  unlockLevel?: number;
}

export interface DashboardGardenCardData {
  title: string;
  iconSrc: string;
  summaryText: string;
  plots: DashboardGardenPlotData[];
}

export interface DashboardTeamMemberData {
  id: number | string;
  slot: number;
  state: GardenPlotState;
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  statusText?: string;
  unlockLevel?: number;
}

export interface DashboardTeamCardData {
  title: string;
  iconSrc: string;
  summaryText: string;
  members: DashboardTeamMemberData[];
}

export interface DashboardHeaderData {
  playerName: string;
  avatarCode: string;
  coins: number;
  gems: number;
  xpCurrent: number;
  xpTarget: number;
}

export interface DashboardTournamentCardData {
  leagueName: string;
  playerPlace: number;
  participantsCount: number;
}

export interface DashboardRewardsCardData {
  coins: number;
  gems: number;
  cards: number;
  chestProgressCurrent: number;
  chestProgressTarget: number;
}

export interface DashboardDto {
  header: DashboardHeaderData;
  gardenCard: DashboardGardenCardData;
  teamCard: DashboardTeamCardData;
  tournamentCard: DashboardTournamentCardData;
  rewardsCard: DashboardRewardsCardData;
}
