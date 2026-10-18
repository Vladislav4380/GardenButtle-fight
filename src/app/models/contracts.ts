export interface LoginResponse {
  playerId: string;
  token: string;
  isNewPlayer: boolean;
}

export interface PlayerProfileResponse {
  playerId: string;
  telegramId: number;
  firstName: string;
  avatarCode: string;
  currencies: {
    seeds: number;
    stars: number;
    tournamentTokens: number;
  };
}

export interface CropTypeDto {
  cropTypeId: string;
  code: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  abilityCode: string;
  abilityName: string;
  growthSeconds: number;
}

export interface GardenPlotDto {
  plotId: string;
  plotIndex: number;
  isUnlocked: boolean;
  isGreenhouse: boolean;
  crop?: {
    playerCropId: string;
    cropCode: string;
    status: string;
    plantedAt?: string;
    readyAt?: string;
  };
}

export interface GardenResponse {
  gardenId: string;
  plots: GardenPlotDto[];
}

export interface OwnedCropDto {
  playerCropId: string;
  cropCode: string;
  harvestedAt: string;
}

export interface OwnedCropsResponse {
  crops: OwnedCropDto[];
}

export interface SeedInventoryItemDto {
  cropTypeId: string;
  cropCode: string;
  quantity: number;
  price: number;
}

export interface GardenEconomyResponse {
  coins: number;
  seeds: SeedInventoryItemDto[];
}

export interface BattleRewardResponse {
  success: boolean;
  coinsGranted: number;
  coinBalance: number;
  error?: string;
}

export interface CommandResult {
  success: boolean;
  error?: string;
}

export interface TeamSlotDto {
  slot: number;
  playerCropId: string;
  cropCode: string;
}

export interface BattleUnitDto {
  unitId: string;
  playerId: string;
  cropCode: string;
  slot: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  abilityCharge: number;
  targetUnitId?: string;
  isAlive: boolean;
}

export interface BattleStateChangedEvent {
  battleId: string;
  status: string | number;
  leftTeam: BattleUnitDto[];
  rightTeam: BattleUnitDto[];
}

export interface DamageAppliedEvent {
  attackerId: string;
  targetId: string;
  damage: number;
  targetHp: number;
}

export interface AbilityUsedEvent {
  unitId: string;
  abilityCode: string;
}

export interface CharacterDiedEvent {
  unitId: string;
}

export interface BattleFinishedEvent {
  battleId: string;
  winnerPlayerId: string;
  seedsReward: number;
  ratingDelta: number;
  chestReward?: string;
}
