/**
 * 🏆 Achievement System
 *
 * Tracks player achievements, statistics, and unlocks in the dodgeball arena.
 */

import {
  Player,
  World,
} from 'hytopia';

import {
  AchievementType,
  ACHIEVEMENT_CONFIG,
  GameMode,
} from './GameConfig.ts';

interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  eliminations: number;
  deaths: number;
  catches: number;
  powerUpsCollected: number;
  timePlayed: number; // in milliseconds
  bestStreak: number;
  achievements: Set<AchievementType>;
  lastActivity: number;
}

interface MatchStats {
  startTime: number;
  eliminations: number;
  catches: number;
  powerUpsCollected: number;
  firstBlood: boolean;
  killStreak: number;
  maxKillStreak: number;
  assists: number;
}

export default class AchievementSystem {
  private static _instance: AchievementSystem;
  private _playerStats: Map<string, PlayerStats> = new Map();
  private _currentMatchStats: Map<string, MatchStats> = new Map();
  private _recentKills: Array<{ playerId: string; timestamp: number }> = [];

  public static get instance(): AchievementSystem {
    if (!this._instance) {
      this._instance = new AchievementSystem();
    }
    return this._instance;
  }

  private constructor() {
    // Clean up old recent kills every minute
    setInterval(() => {
      const now = Date.now();
      this._recentKills = this._recentKills.filter(kill => now - kill.timestamp < 60000);
    }, 60000);
  }

  // Initialize player stats
  public initializePlayer(player: Player): void {
    const playerId = player.id;
    if (!this._playerStats.has(playerId)) {
      this._playerStats.set(playerId, {
        gamesPlayed: 0,
        gamesWon: 0,
        eliminations: 0,
        deaths: 0,
        catches: 0,
        powerUpsCollected: 0,
        timePlayed: 0,
        bestStreak: 0,
        achievements: new Set(),
        lastActivity: Date.now(),
      });
    }
  }

  // Start tracking match statistics
  public startMatch(player: Player): void {
    const playerId = player.id;
    this._currentMatchStats.set(playerId, {
      startTime: Date.now(),
      eliminations: 0,
      catches: 0,
      powerUpsCollected: 0,
      firstBlood: false,
      killStreak: 0,
      maxKillStreak: 0,
      assists: 0,
    });
  }

  // Record an elimination
  public recordElimination(player: Player, victimId: string): void {
    const playerId = player.id;
    const stats = this._playerStats.get(playerId);
    const matchStats = this._currentMatchStats.get(playerId);

    if (!stats || !matchStats) return;

    // Update statistics
    stats.eliminations++;
    matchStats.eliminations++;

    // Check for first blood
    if (this._recentKills.length === 0) {
      matchStats.firstBlood = true;
      this.unlockAchievement(player, AchievementType.FIRST_BLOOD);
    }

    // Track kill streak
    matchStats.killStreak++;
    if (matchStats.killStreak > matchStats.maxKillStreak) {
      matchStats.maxKillStreak = matchStats.killStreak;
    }

    // Check for multi-kills
    this.checkMultiKills(player, matchStats);

    // Add to recent kills for multi-kill detection
    this._recentKills.push({ playerId, timestamp: Date.now() });

    // Update best streak
    if (matchStats.maxKillStreak > stats.bestStreak) {
      stats.bestStreak = matchStats.maxKillStreak;
    }
  }

  // Record a catch
  public recordCatch(player: Player): void {
    const playerId = player.id;
    const stats = this._playerStats.get(playerId);
    const matchStats = this._currentMatchStats.get(playerId);

    if (!stats || !matchStats) return;

    stats.catches++;
    matchStats.catches++;

    // Check for catch master achievement
    if (matchStats.catches >= 10) {
      this.unlockAchievement(player, AchievementType.CATCH_MASTER);
    }
  }

  // Record power-up collection
  public recordPowerUpCollection(player: Player): void {
    const playerId = player.id;
    const stats = this._playerStats.get(playerId);
    const matchStats = this._currentMatchStats.get(playerId);

    if (!stats || !matchStats) return;

    stats.powerUpsCollected++;
    matchStats.powerUpsCollected++;

    // Check for power-up collector achievement
    if (matchStats.powerUpsCollected >= 20) {
      this.unlockAchievement(player, AchievementType.POWER_UP_COLLECTOR);
    }
  }

  // Record a death
  public recordDeath(player: Player): void {
    const playerId = player.id;
    const stats = this._playerStats.get(playerId);
    const matchStats = this._currentMatchStats.get(playerId);

    if (!stats || !matchStats) return;

    stats.deaths++;

    // Reset kill streak on death
    matchStats.killStreak = 0;
  }

  // End match and check for achievements
  public endMatch(player: Player, won: boolean, survived: boolean): void {
    const playerId = player.id;
    const stats = this._playerStats.get(playerId);
    const matchStats = this._currentMatchStats.get(playerId);

    if (!stats || !matchStats) return;

    // Update match statistics
    stats.gamesPlayed++;
    if (won) {
      stats.gamesWon++;
    }

    const matchDuration = Date.now() - matchStats.startTime;
    stats.timePlayed += matchDuration;

    // Check for survivor achievement
    if (survived && matchStats.eliminations === 0) {
      this.unlockAchievement(player, AchievementType.SURVIVOR);
    }

    // Check for team player achievement
    if (stats.gamesWon >= 5) {
      this.unlockAchievement(player, AchievementType.TEAM_PLAYER);
    }

    // Clear match stats
    this._currentMatchStats.delete(playerId);
  }

  // Check for multi-kill achievements
  private checkMultiKills(player: Player, matchStats: MatchStats): void {
    const recentPlayerKills = this._recentKills
      .filter(kill => kill.playerId === player.id)
      .filter(kill => Date.now() - kill.timestamp <= 10000); // Within 10 seconds

    if (recentPlayerKills.length >= 2) {
      this.unlockAchievement(player, AchievementType.DOUBLE_KILL);
    }

    if (recentPlayerKills.length >= 3) {
      this.unlockAchievement(player, AchievementType.TRIPLE_KILL);
    }
  }

  // Unlock an achievement
  private unlockAchievement(player: Player, achievementType: AchievementType): void {
    const stats = this._playerStats.get(player.id);
    if (!stats) return;

    // Check if already unlocked
    if (stats.achievements.has(achievementType)) return;

    // Unlock achievement
    stats.achievements.add(achievementType);
    const config = ACHIEVEMENT_CONFIG[achievementType];

    // Notify player
    if (this.world) {
      this.world.chatManager.sendPlayerMessage(
        player,
        `🏆 Achievement Unlocked: ${config.name}! (+${config.points} points)`,
        'FFD700'
      );

      // Broadcast to all players
      this.world.chatManager.sendBroadcastMessage(
        `${player.username} unlocked: ${config.name} ${config.icon}`,
        'FFD700'
      );
    }

    console.log(`🏆 ${player.username} unlocked achievement: ${config.name}`);
  }

  // Get player statistics
  public getPlayerStats(playerId: string): PlayerStats | undefined {
    return this._playerStats.get(playerId);
  }

  // Get achievement progress
  public getAchievementProgress(playerId: string): Record<string, any> {
    const stats = this._playerStats.get(playerId);
    if (!stats) return {};

    return {
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      eliminations: stats.eliminations,
      catches: stats.catches,
      powerUpsCollected: stats.powerUpsCollected,
      bestStreak: stats.bestStreak,
      achievements: Array.from(stats.achievements),
      winRate: stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0,
      kdRatio: stats.deaths > 0 ? stats.eliminations / stats.deaths : stats.eliminations,
    };
  }

  // Get leaderboard data
  public getLeaderboard(sortBy: 'eliminations' | 'wins' | 'catches' | 'streak' = 'eliminations'): Array<any> {
    const players = Array.from(this._playerStats.entries())
      .map(([playerId, stats]) => ({
        playerId,
        ...this.getAchievementProgress(playerId),
      }))
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, 10); // Top 10

    return players;
  }

  // Clean up inactive players (optional)
  public cleanupInactivePlayers(maxInactiveTime: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [playerId, stats] of this._playerStats) {
      if (now - stats.lastActivity > maxInactiveTime) {
        toRemove.push(playerId);
      }
    }

    toRemove.forEach(playerId => {
      this._playerStats.delete(playerId);
    });

    if (toRemove.length > 0) {
      console.log(`🧹 Cleaned up ${toRemove.length} inactive player profiles`);
    }
  }

  // Get world reference (set by GameManager)
  private _world: World | undefined;
  public set world(world: World) {
    this._world = world;
  }
  public get world(): World | undefined {
    return this._world;
  }
}
