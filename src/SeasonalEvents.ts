/**
 * 🎄 Seasonal Events System
 *
 * Dynamic seasonal events with unique mechanics, cosmetics, and gameplay modifiers
 * to keep the game fresh and exciting throughout the year.
 */

import {
  World,
  Player,
} from 'hytopia';

import {
  GameMode,
  GameConfig,
  PowerUpType,
  Team,
} from './GameConfig.ts';
import GameManager from './GameManager.ts';

export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  AUTUMN = 'autumn',
  WINTER = 'winter',
  HALLOWEEN = 'halloween',
  CHRISTMAS = 'christmas',
  NEW_YEAR = 'new_year',
  VALENTINES = 'valentines',
  EASTER = 'easter',
  APRIL_FOOLS = 'april_fools',
}

export enum EventType {
  COSMETIC = 'cosmetic',           // Visual changes only
  GAMEPLAY = 'gameplay',           // Gameplay modifiers
  POWER_UP = 'power_up',           // Special power-ups
  SPECIAL_MODE = 'special_mode',   // Unique game modes
  TOURNAMENT = 'tournament',       // Special tournaments
  LIMITED_TIME = 'limited_time',   // Time-limited events
}

interface SeasonalEvent {
  id: string;
  name: string;
  description: string;
  season: Season;
  type: EventType;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  modifiers: EventModifier[];
  cosmetics: CosmeticChange[];
  rewards: EventReward[];
  requirements?: EventRequirement;
}

interface EventModifier {
  type: 'power_up_spawn_rate' | 'player_speed' | 'dodgeball_damage' | 'game_duration' | 'special_rules';
  value: any;
  description: string;
}

interface CosmeticChange {
  type: 'skybox' | 'lighting' | 'particles' | 'player_models' | 'arena_decorations';
  asset: string;
  description: string;
}

interface EventReward {
  type: 'cosmetic' | 'title' | 'achievement' | 'bonus_xp';
  item: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
}

interface EventRequirement {
  minPlayers: number;
  maxPlayers: number;
  gameModes: GameMode[];
  playerLevel?: number;
}

export default class SeasonalEvents {
  private static _instance: SeasonalEvents;
  private _world: World | undefined;
  private _currentSeason: Season;
  private _activeEvents: SeasonalEvent[] = [];
  private _eventUpdateInterval: NodeJS.Timeout | undefined;
  private _seasonalThemes: Map<Season, SeasonalTheme> = new Map();

  public static get instance(): SeasonalEvents {
    if (!this._instance) {
      this._instance = new SeasonalEvents();
    }
    return this._instance;
  }

  private constructor() {
    this._currentSeason = this.determineCurrentSeason();
    this.initializeSeasonalThemes();
    this.initializeSeasonalEvents();
  }

  public initialize(world: World): void {
    this._world = world;
    this.startEventUpdates();
    this.activateCurrentSeasonEvents();
    console.log(`🎄 Seasonal Events initialized - Current season: ${this._currentSeason}`);
  }

  private determineCurrentSeason(): Season {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();

    // Special holiday seasons
    if (month === 9 && day >= 25 && day <= 31) return Season.HALLOWEEN; // Oct 25-31
    if (month === 11 && day >= 20 && day <= 31) return Season.CHRISTMAS; // Dec 20-31
    if (month === 0 && day === 1) return Season.NEW_YEAR; // Jan 1
    if (month === 1 && day >= 10 && day <= 16) return Season.VALENTINES; // Feb 10-16
    if (month === 3 && day === 1) return Season.APRIL_FOOLS; // Apr 1
    if (month === 3 && (day >= 20 && day <= 26)) return Season.EASTER; // Apr 20-26 (approximate)

    // Regular seasons
    if (month >= 2 && month <= 4) return Season.SPRING; // Mar-May
    if (month >= 5 && month <= 7) return Season.SUMMER; // Jun-Aug
    if (month >= 8 && month <= 10) return Season.AUTUMN; // Sep-Nov
    return Season.WINTER; // Dec-Feb
  }

  private initializeSeasonalThemes(): void {
    this._seasonalThemes.set(Season.SPRING, {
      name: 'Spring Awakening',
      description: 'Fresh blooms and renewal bring new life to the arena',
      colors: { primary: '#4CAF50', secondary: '#81C784', accent: '#FFEB3B' },
      atmosphere: 'fresh',
      music: 'spring_theme.mp3',
    });

    this._seasonalThemes.set(Season.SUMMER, {
      name: 'Summer Heat',
      description: 'Intense heat waves and beach vibes take over',
      colors: { primary: '#FF5722', secondary: '#FF9800', accent: '#FFD54F' },
      atmosphere: 'hot',
      music: 'summer_theme.mp3',
    });

    this._seasonalThemes.set(Season.AUTUMN, {
      name: 'Autumn Harvest',
      description: 'Falling leaves and crisp air bring harvest festivities',
      colors: { primary: '#FF5722', secondary: '#795548', accent: '#FFC107' },
      atmosphere: 'crisp',
      music: 'autumn_theme.mp3',
    });

    this._seasonalThemes.set(Season.WINTER, {
      name: 'Winter Wonderland',
      description: 'Snow-covered arenas and festive celebrations',
      colors: { primary: '#2196F3', secondary: '#90CAF9', accent: '#E3F2FD' },
      atmosphere: 'cold',
      music: 'winter_theme.mp3',
    });

    this._seasonalThemes.set(Season.HALLOWEEN, {
      name: 'Halloween Horror',
      description: 'Spooky decorations and frightening power-ups',
      colors: { primary: '#4A148C', secondary: '#7B1FA2', accent: '#FF5722' },
      atmosphere: 'spooky',
      music: 'halloween_theme.mp3',
    });

    this._seasonalThemes.set(Season.CHRISTMAS, {
      name: 'Holiday Cheer',
      description: 'Festive decorations and holiday spirit fill the air',
      colors: { primary: '#D32F2F', secondary: '#388E3C', accent: '#FFD700' },
      atmosphere: 'festive',
      music: 'christmas_theme.mp3',
    });

    this._seasonalThemes.set(Season.NEW_YEAR, {
      name: 'New Year Celebration',
      description: 'Fireworks and resolutions for the new year',
      colors: { primary: '#FFD700', secondary: '#FF5722', accent: '#4CAF50' },
      atmosphere: 'celebratory',
      music: 'new_year_theme.mp3',
    });

    this._seasonalThemes.set(Season.VALENTINES, {
      name: 'Love is in the Air',
      description: 'Romantic atmosphere with heart-themed cosmetics',
      colors: { primary: '#E91E63', secondary: '#F48FB1', accent: '#FFD54F' },
      atmosphere: 'romantic',
      music: 'valentines_theme.mp3',
    });

    this._seasonalThemes.set(Season.EASTER, {
      name: 'Easter Egg Hunt',
      description: 'Hidden eggs and springtime celebrations',
      colors: { primary: '#4CAF50', secondary: '#81C784', accent: '#FFD54F' },
      atmosphere: 'joyful',
      music: 'easter_theme.mp3',
    });

    this._seasonalThemes.set(Season.APRIL_FOOLS, {
      name: 'April Fools Chaos',
      description: 'Pranks and surprises everywhere!',
      colors: { primary: '#FF5722', secondary: '#FFC107', accent: '#9C27B0' },
      atmosphere: 'chaotic',
      music: 'april_fools_theme.mp3',
    });
  }

  private initializeSeasonalEvents(): void {
    // Spring Events
    this.addSeasonalEvent({
      id: 'spring_blossom',
      name: 'Spring Blossom Festival',
      description: 'Beautiful cherry blossoms fall from the sky',
      season: Season.SPRING,
      type: EventType.COSMETIC,
      startDate: new Date('2024-03-20'),
      endDate: new Date('2024-04-10'),
      isActive: false,
      modifiers: [],
      cosmetics: [
        { type: 'skybox', asset: 'spring_skybox.jpg', description: 'Bright spring sky' },
        { type: 'particles', asset: 'cherry_blossoms', description: 'Falling cherry blossoms' },
      ],
      rewards: [
        { type: 'cosmetic', item: 'Cherry Blossom Hat', rarity: 'rare', description: 'Beautiful floral headwear' },
        { type: 'title', item: 'Spring Guardian', rarity: 'epic', description: 'Protects the beauty of spring' },
      ],
    });

    // Halloween Events
    this.addSeasonalEvent({
      id: 'halloween_nightmare',
      name: 'Halloween Nightmare',
      description: 'Terrifying power-ups and spooky atmosphere',
      season: Season.HALLOWEEN,
      type: EventType.GAMEPLAY,
      startDate: new Date('2024-10-25'),
      endDate: new Date('2024-10-31'),
      isActive: false,
      modifiers: [
        { type: 'power_up_spawn_rate', value: 0.5, description: 'Increased power-up spawns' },
        { type: 'special_rules', value: 'ghost_mode', description: 'Players become temporarily invisible when hit' },
      ],
      cosmetics: [
        { type: 'lighting', asset: 'spooky_lighting', description: 'Eerie purple lighting' },
        { type: 'arena_decorations', asset: 'pumpkins_and_graves', description: 'Halloween decorations' },
      ],
      rewards: [
        { type: 'cosmetic', item: 'Ghost Cape', rarity: 'epic', description: 'Spooky invisibility cloak' },
        { type: 'achievement', item: 'Nightmare Survivor', rarity: 'legendary', description: 'Survive the Halloween nightmare' },
      ],
    });

    // Christmas Events
    this.addSeasonalEvent({
      id: 'christmas_cheer',
      name: 'Christmas Cheer Tournament',
      description: 'Festive tournament with holiday-themed power-ups',
      season: Season.CHRISTMAS,
      type: EventType.TOURNAMENT,
      startDate: new Date('2024-12-20'),
      endDate: new Date('2024-12-31'),
      isActive: false,
      modifiers: [
        { type: 'game_duration', value: 180000, description: '3-minute matches' },
        { type: 'special_rules', value: 'gift_drops', description: 'Random gift boxes drop power-ups' },
      ],
      cosmetics: [
        { type: 'arena_decorations', asset: 'christmas_trees', description: 'Festive Christmas trees' },
        { type: 'particles', asset: 'snowflakes', description: 'Falling snow' },
      ],
      rewards: [
        { type: 'cosmetic', item: 'Santa Hat', rarity: 'legendary', description: 'Magical holiday headwear' },
        { type: 'title', item: 'Holiday Champion', rarity: 'legendary', description: 'Champion of the holidays' },
      ],
      requirements: {
        minPlayers: 8,
        maxPlayers: 16,
        gameModes: [GameMode.CLASSIC],
      },
    });

    // April Fools Events
    this.addSeasonalEvent({
      id: 'april_fools_chaos',
      name: 'April Fools Chaos',
      description: 'Controls are reversed and power-ups are randomized!',
      season: Season.APRIL_FOOLS,
      type: EventType.LIMITED_TIME,
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-04-01'),
      isActive: false,
      modifiers: [
        { type: 'special_rules', value: 'controls_reversed', description: 'Left becomes right, up becomes down' },
        { type: 'special_rules', value: 'random_power_ups', description: 'Power-ups have random effects' },
      ],
      cosmetics: [],
      rewards: [
        { type: 'title', item: 'Prankster', rarity: 'rare', description: 'Master of April Fools' },
      ],
    });
  }

  private addSeasonalEvent(event: SeasonalEvent): void {
    // Check if event should be active based on current date
    const now = new Date();
    if (now >= event.startDate && now <= event.endDate) {
      event.isActive = true;
      this._activeEvents.push(event);
    }
  }

  private activateCurrentSeasonEvents(): void {
    const currentTheme = this._seasonalThemes.get(this._currentSeason);
    if (currentTheme) {
      console.log(`🎄 Activating ${currentTheme.name} theme`);
      this.applySeasonalTheme(currentTheme);
    }

    // Activate season-specific events
    const seasonEvents = this._activeEvents.filter(event => event.season === this._currentSeason);
    seasonEvents.forEach(event => {
      this.activateEvent(event);
    });

    console.log(`🎄 Activated ${seasonEvents.length} seasonal events for ${this._currentSeason}`);
  }

  private applySeasonalTheme(theme: SeasonalTheme): void {
    if (!this._world) return;

    // Apply theme colors to UI (would integrate with UI system)
    console.log(`🎨 Applying theme: ${theme.name} - ${theme.description}`);

    // Apply atmospheric changes
    this.applyAtmosphericChanges(theme.atmosphere);

    // Play seasonal music
    this.playSeasonalMusic(theme.music);
  }

  private applyAtmosphericChanges(atmosphere: string): void {
    if (!this._world) return;

    switch (atmosphere) {
      case 'hot':
        // Increase ambient temperature effects
        this._world.setAmbientLightIntensity(1.5);
        break;
      case 'cold':
        // Add snow/winter effects
        this._world.setAmbientLightIntensity(0.8);
        break;
      case 'spooky':
        // Dim lighting, add fog
        this._world.setAmbientLightIntensity(0.6);
        break;
      case 'festive':
        // Bright, warm lighting
        this._world.setAmbientLightIntensity(1.3);
        break;
    }
  }

  private playSeasonalMusic(musicFile: string): void {
    // Implementation would integrate with audio system
    console.log(`🎵 Playing seasonal music: ${musicFile}`);
  }

  private activateEvent(event: SeasonalEvent): void {
    console.log(`🎯 Activating event: ${event.name} - ${event.description}`);

    // Apply event modifiers
    event.modifiers.forEach(modifier => {
      this.applyEventModifier(modifier);
    });

    // Apply cosmetics
    event.cosmetics.forEach(cosmetic => {
      this.applyCosmeticChange(cosmetic);
    });

    // Announce event to players
    if (this._world) {
      this._world.chatManager.sendBroadcastMessage(
        `🎉 ${event.name} is now active! ${event.description}`,
        'FFD700'
      );
    }
  }

  private applyEventModifier(modifier: EventModifier): void {
    switch (modifier.type) {
      case 'power_up_spawn_rate':
        // Modify power-up spawn rate (would integrate with PowerUpEntity)
        console.log(`⚡ Modified power-up spawn rate: ${modifier.value}`);
        break;
      case 'player_speed':
        // Modify player movement speed
        console.log(`🏃 Modified player speed: ${modifier.value}`);
        break;
      case 'dodgeball_damage':
        // Modify dodgeball damage
        console.log(`💥 Modified dodgeball damage: ${modifier.value}`);
        break;
      case 'game_duration':
        // Modify match duration
        console.log(`⏰ Modified game duration: ${modifier.value}ms`);
        break;
      case 'special_rules':
        // Apply special game rules
        console.log(`🎲 Applied special rule: ${modifier.value}`);
        break;
    }
  }

  private applyCosmeticChange(cosmetic: CosmeticChange): void {
    switch (cosmetic.type) {
      case 'skybox':
        // Change skybox
        console.log(`🌅 Changed skybox to: ${cosmetic.asset}`);
        break;
      case 'lighting':
        // Modify lighting
        console.log(`💡 Applied lighting: ${cosmetic.asset}`);
        break;
      case 'particles':
        // Add particle effects
        console.log(`✨ Added particles: ${cosmetic.asset}`);
        break;
      case 'player_models':
        // Change player models
        console.log(`👤 Changed player models: ${cosmetic.asset}`);
        break;
      case 'arena_decorations':
        // Add arena decorations
        console.log(`🏟️ Added decorations: ${cosmetic.asset}`);
        break;
    }
  }

  // Event participation and rewards
  public participateInEvent(player: Player, eventId: string): boolean {
    const event = this._activeEvents.find(e => e.id === eventId);
    if (!event) return false;

    // Check requirements
    if (event.requirements) {
      const gameManager = GameManager.instance;
      const playerCount = gameManager.getGameStats().totalPlayers || 0;

      if (playerCount < event.requirements.minPlayers ||
          playerCount > event.requirements.maxPlayers) {
        return false;
      }
    }

    // Record participation
    console.log(`🎯 ${player.username} participating in event: ${event.name}`);

    // Award participation rewards
    this.awardEventRewards(player, event);

    return true;
  }

  private awardEventRewards(player: Player, event: SeasonalEvent): void {
    event.rewards.forEach(reward => {
      switch (reward.type) {
        case 'cosmetic':
          console.log(`🎨 Awarded cosmetic: ${reward.item} (${reward.rarity})`);
          break;
        case 'title':
          console.log(`🏷️ Awarded title: ${reward.item} (${reward.rarity})`);
          break;
        case 'achievement':
          console.log(`🏆 Awarded achievement: ${reward.item} (${reward.rarity})`);
          break;
        case 'bonus_xp':
          console.log(`⭐ Awarded XP: ${reward.item}`);
          break;
      }

      // Send reward notification
      if (this._world) {
        this._world.chatManager.sendPlayerMessage(
          player,
          `🎁 Event Reward: ${reward.item} (${reward.rarity.toUpperCase()})`,
          'FFD700'
        );
      }
    });
  }

  // Periodic event updates
  private startEventUpdates(): void {
    this._eventUpdateInterval = setInterval(() => {
      this.updateEvents();
    }, 60000); // Update every minute
  }

  private updateEvents(): void {
    const now = new Date();

    // Check for expired events
    this._activeEvents = this._activeEvents.filter(event => {
      if (now > event.endDate) {
        console.log(`⏰ Event expired: ${event.name}`);
        return false;
      }
      return true;
    });

    // Check for newly activated events
    // This would check the events list for any that should now be active

    // Update event-specific mechanics
    this._activeEvents.forEach(event => {
      this.updateEventMechanics(event);
    });
  }

  private updateEventMechanics(event: SeasonalEvent): void {
    // Update dynamic event mechanics
    switch (event.id) {
      case 'christmas_cheer':
        // Spawn gift boxes periodically
        if (Math.random() < 0.1) { // 10% chance per update
          console.log(`🎁 Spawning Christmas gift box`);
        }
        break;
      case 'halloween_nightmare':
        // Random spooky effects
        if (Math.random() < 0.05) { // 5% chance per update
          console.log(`👻 Halloween spooky effect triggered`);
        }
        break;
    }
  }

  // Public API methods
  public getCurrentSeason(): Season {
    return this._currentSeason;
  }

  public getSeasonalTheme(): SeasonalTheme | undefined {
    return this._seasonalThemes.get(this._currentSeason);
  }

  public getActiveEvents(): SeasonalEvent[] {
    return this._activeEvents;
  }

  public getEventById(eventId: string): SeasonalEvent | undefined {
    return this._activeEvents.find(event => event.id === eventId);
  }

  public getEventsBySeason(season: Season): SeasonalEvent[] {
    return this._activeEvents.filter(event => event.season === season);
  }

  public getSeasonalStats(): any {
    const theme = this._seasonalThemes.get(this._currentSeason);
    const activeEventCount = this._activeEvents.length;
    const totalRewardsDistributed = this.calculateTotalRewards();

    return {
      currentSeason: this._currentSeason,
      theme: theme?.name,
      activeEvents: activeEventCount,
      totalRewardsDistributed,
      popularEvents: this.getPopularEvents(),
    };
  }

  private calculateTotalRewards(): number {
    // This would track actual rewards distributed
    return this._activeEvents.reduce((total, event) => total + event.rewards.length, 0);
  }

  private getPopularEvents(): any[] {
    // This would track event participation
    return this._activeEvents.slice(0, 3).map(event => ({
      name: event.name,
      type: event.type,
      participants: Math.floor(Math.random() * 50) + 10, // Placeholder
    }));
  }

  // Cleanup
  public cleanup(): void {
    if (this._eventUpdateInterval) {
      clearInterval(this._eventUpdateInterval);
      this._eventUpdateInterval = undefined;
    }

    // Deactivate all events
    this._activeEvents = [];
    console.log('🎄 Seasonal Events cleaned up');
  }
}

// Type definitions
interface SeasonalTheme {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  atmosphere: string;
  music: string;
}
