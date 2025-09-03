/**
 * 📊 Statistics Dashboard
 *
 * Comprehensive analytics system for tracking player performance,
 * tournament statistics, and server metrics.
 */

import {
  Player,
  World,
} from 'hytopia';

import AchievementSystem from './AchievementSystem.ts';
import TournamentManager from './TournamentManager.ts';
import GameManager from './GameManager.ts';
import {
  GameMode,
  AchievementType,
  ACHIEVEMENT_CONFIG,
} from './GameConfig.ts';

interface PlayerStatistics {
  playerId: string;
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  totalEliminations: number;
  totalDeaths: number;
  totalCatches: number;
  totalPowerUpsCollected: number;
  winRate: number;
  kdRatio: number;
  averageScore: number;
  bestStreak: number;
  totalPlayTime: number; // in milliseconds
  achievements: AchievementType[];
  favoriteGameMode: GameMode;
  lastActive: number;
  ranking: number;
  skillRating: number;
}

interface TournamentStatistics {
  tournamentId: string;
  name: string;
  winner: string;
  participants: number;
  duration: number; // in milliseconds
  matchesPlayed: number;
  totalEliminations: number;
  averageMatchDuration: number;
  completionRate: number; // percentage of matches completed
}

interface ServerStatistics {
  totalPlayers: number;
  activePlayers: number;
  totalGamesPlayed: number;
  totalTournamentsHeld: number;
  serverUptime: number;
  averageGameDuration: number;
  peakConcurrentPlayers: number;
  totalEliminations: number;
  totalPowerUpsCollected: number;
  memoryUsage: any;
  popularGameModes: Record<GameMode, number>;
}

interface DashboardData {
  playerStats: PlayerStatistics[];
  tournamentStats: TournamentStatistics[];
  serverStats: ServerStatistics;
  leaderboard: PlayerStatistics[];
  recentAchievements: Array<{
    player: string;
    achievement: AchievementType;
    timestamp: number;
  }>;
  gameModeStats: Record<GameMode, {
    gamesPlayed: number;
    averageDuration: number;
    popularity: number;
  }>;
}

export default class StatisticsDashboard {
  private static _instance: StatisticsDashboard;
  private _world: World | undefined;
  private _dashboardData: DashboardData;
  private _updateInterval: NodeJS.Timeout | undefined;
  private _lastUpdate: number = 0;
  private _updateFrequency: number = 30000; // 30 seconds

  public static get instance(): StatisticsDashboard {
    if (!this._instance) {
      this._instance = new StatisticsDashboard();
    }
    return this._instance;
  }

  private constructor() {
    this._dashboardData = {
      playerStats: [],
      tournamentStats: [],
      serverStats: this.getInitialServerStats(),
      leaderboard: [],
      recentAchievements: [],
      gameModeStats: this.getInitialGameModeStats(),
    };
  }

  public initialize(world: World): void {
    this._world = world;
    this.startPeriodicUpdates();
    console.log('📊 Statistics Dashboard initialized');
  }

  // Start periodic data collection and updates
  private startPeriodicUpdates(): void {
    this._updateInterval = setInterval(() => {
      this.updateDashboardData();
    }, this._updateFrequency);

    // Initial update
    this.updateDashboardData();
  }

  // Update all dashboard data
  private updateDashboardData(): void {
    const now = Date.now();

    if (now - this._lastUpdate < this._updateFrequency) {
      return; // Throttle updates
    }

    this._lastUpdate = now;

    try {
      this._dashboardData.playerStats = this.collectPlayerStatistics();
      this._dashboardData.tournamentStats = this.collectTournamentStatistics();
      this._dashboardData.serverStats = this.collectServerStatistics();
      this._dashboardData.leaderboard = this.generateLeaderboard();
      this._dashboardData.recentAchievements = this.collectRecentAchievements();

      console.log('📊 Dashboard data updated successfully');
    } catch (error) {
      console.error('❌ Failed to update dashboard data:', error);
    }
  }

  // Collect comprehensive player statistics
  private collectPlayerStatistics(): PlayerStatistics[] {
    const achievementStats = AchievementSystem.instance.getAllPlayerStats();
    const gameManager = GameManager.instance;

    return Object.entries(achievementStats).map(([playerId, stats], index) => {
      const playerEntity = gameManager.getPlayerEntity(playerId);
      const winRate = stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0;
      const kdRatio = stats.deaths > 0 ? stats.eliminations / stats.deaths : stats.eliminations;
      const averageScore = this.calculateAverageScore(stats);

      return {
        playerId,
        username: playerEntity?.player.username || `Player_${playerId.slice(-4)}`,
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        totalEliminations: stats.eliminations,
        totalDeaths: stats.deaths,
        totalCatches: stats.catches,
        totalPowerUpsCollected: stats.powerUpsCollected,
        winRate,
        kdRatio,
        averageScore,
        bestStreak: stats.bestStreak,
        totalPlayTime: stats.timePlayed,
        achievements: Array.from(stats.achievements),
        favoriteGameMode: this.determineFavoriteGameMode(playerId),
        lastActive: stats.lastActivity,
        ranking: index + 1,
        skillRating: this.calculateSkillRating(stats),
      };
    });
  }

  // Collect tournament statistics
  private collectTournamentStatistics(): TournamentStatistics[] {
    const tournamentHistory = TournamentManager.instance.tournamentHistory;

    return tournamentHistory.map(tournament => {
      const duration = tournament.finishedAt && tournament.startedAt
        ? tournament.finishedAt - tournament.startedAt
        : 0;

      const matchesPlayed = tournament.bracket.matches.length;
      const completedMatches = tournament.bracket.matches.filter(
        match => match.status === 'completed'
      ).length;

      const totalEliminations = tournament.bracket.matches.reduce(
        (total, match) => total + (match.score ? match.score.player1 + match.score.player2 : 0),
        0
      );

      return {
        tournamentId: tournament.id,
        name: tournament.name,
        winner: tournament.winner?.player.username || 'Unknown',
        participants: tournament.players.length,
        duration,
        matchesPlayed,
        totalEliminations,
        averageMatchDuration: duration / Math.max(completedMatches, 1),
        completionRate: matchesPlayed > 0 ? (completedMatches / matchesPlayed) * 100 : 0,
      };
    });
  }

  // Collect server-wide statistics
  private collectServerStatistics(): ServerStatistics {
    const gameManager = GameManager.instance;
    const tournamentManager = TournamentManager.instance;
    const achievementSystem = AchievementSystem.instance;

    const gameStats = gameManager.getGameStats();
    const tournamentStats = tournamentManager.getTournamentStats();

    // Calculate popular game modes
    const popularGameModes = this.calculatePopularGameModes();

    return {
      totalPlayers: gameStats.totalPlayers || 0,
      activePlayers: gameStats.alivePlayers || 0,
      totalGamesPlayed: this.calculateTotalGamesPlayed(),
      totalTournamentsHeld: tournamentManager.tournamentHistory.length,
      serverUptime: process.uptime() * 1000, // convert to milliseconds
      averageGameDuration: this.calculateAverageGameDuration(),
      peakConcurrentPlayers: this.calculatePeakConcurrentPlayers(),
      totalEliminations: this.calculateTotalEliminations(),
      totalPowerUpsCollected: this.calculateTotalPowerUpsCollected(),
      memoryUsage: process.memoryUsage(),
      popularGameModes,
    };
  }

  // Generate leaderboard
  private generateLeaderboard(): PlayerStatistics[] {
    return this._dashboardData.playerStats
      .sort((a, b) => b.skillRating - a.skillRating)
      .slice(0, 10); // Top 10 players
  }

  // Collect recent achievements
  private collectRecentAchievements(): Array<{
    player: string;
    achievement: AchievementType;
    timestamp: number;
  }> {
    // This would need to be implemented with a proper achievement tracking system
    // For now, return empty array
    return [];
  }

  // Helper calculation methods
  private calculateAverageScore(stats: any): number {
    const eliminationPoints = stats.eliminations * 10;
    const catchPoints = stats.catches * 3;
    const powerUpPoints = stats.powerUpsCollected * 2;
    const winPoints = stats.gamesWon * 25;

    const totalPoints = eliminationPoints + catchPoints + powerUpPoints + winPoints;
    return stats.gamesPlayed > 0 ? totalPoints / stats.gamesPlayed : 0;
  }

  private determineFavoriteGameMode(playerId: string): GameMode {
    // This would require tracking game mode preferences per player
    // For now, return a default
    return GameMode.CLASSIC;
  }

  private calculateSkillRating(stats: any): number {
    const winRate = stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0;
    const kdRatio = stats.deaths > 0 ? stats.eliminations / stats.deaths : stats.eliminations;

    // Simple skill rating calculation
    return (winRate * 100) + (kdRatio * 10) + (stats.bestStreak * 2) + stats.achievements.size;
  }

  private calculateTotalGamesPlayed(): number {
    return this._dashboardData.playerStats.reduce(
      (total, player) => total + player.gamesPlayed,
      0
    );
  }

  private calculateAverageGameDuration(): number {
    // This would require tracking individual game durations
    // For now, return a placeholder
    return 300000; // 5 minutes average
  }

  private calculatePeakConcurrentPlayers(): number {
    // This would require tracking peak concurrent players
    // For now, return current player count
    return this._dashboardData.serverStats.activePlayers;
  }

  private calculateTotalEliminations(): number {
    return this._dashboardData.playerStats.reduce(
      (total, player) => total + player.totalEliminations,
      0
    );
  }

  private calculateTotalPowerUpsCollected(): number {
    return this._dashboardData.playerStats.reduce(
      (total, player) => total + player.totalPowerUpsCollected,
      0
    );
  }

  private calculatePopularGameModes(): Record<GameMode, number> {
    // This would require tracking game mode usage
    // For now, return placeholder data
    return {
      [GameMode.CLASSIC]: 45,
      [GameMode.SURVIVAL]: 25,
      [GameMode.TIME_ATTACK]: 15,
      [GameMode.POWER_UP_MADNESS]: 10,
      [GameMode.CHAOS]: 5,
    };
  }

  private getInitialServerStats(): ServerStatistics {
    return {
      totalPlayers: 0,
      activePlayers: 0,
      totalGamesPlayed: 0,
      totalTournamentsHeld: 0,
      serverUptime: 0,
      averageGameDuration: 0,
      peakConcurrentPlayers: 0,
      totalEliminations: 0,
      totalPowerUpsCollected: 0,
      memoryUsage: process.memoryUsage(),
      popularGameModes: this.getInitialGameModeStats(),
    };
  }

  private getInitialGameModeStats(): Record<GameMode, number> {
    return {
      [GameMode.CLASSIC]: 0,
      [GameMode.SURVIVAL]: 0,
      [GameMode.TIME_ATTACK]: 0,
      [GameMode.POWER_UP_MADNESS]: 0,
      [GameMode.CHAOS]: 0,
    };
  }

  // Public API methods
  public getDashboardData(): DashboardData {
    return { ...this._dashboardData };
  }

  public getPlayerStats(playerId: string): PlayerStatistics | undefined {
    return this._dashboardData.playerStats.find(stats => stats.playerId === playerId);
  }

  public getLeaderboard(limit: number = 10): PlayerStatistics[] {
    return this._dashboardData.leaderboard.slice(0, limit);
  }

  public getServerStats(): ServerStatistics {
    return this._dashboardData.serverStats;
  }

  public getTournamentStats(): TournamentStatistics[] {
    return this._dashboardData.tournamentStats;
  }

  public getGameModeStats(): Record<GameMode, {
    gamesPlayed: number;
    averageDuration: number;
    popularity: number;
  }> {
    return this._dashboardData.gameModeStats;
  }

  // Generate formatted report
  public generateReport(): string {
    const data = this._dashboardData;
    const serverStats = data.serverStats;

    let report = '📊 Ultimate Dodgeball Arena - Statistics Report\n';
    report += '=' .repeat(50) + '\n\n';

    // Server Statistics
    report += '🖥️ SERVER STATISTICS\n';
    report += `Total Players: ${serverStats.totalPlayers}\n`;
    report += `Active Players: ${serverStats.activePlayers}\n`;
    report += `Total Games: ${serverStats.totalGamesPlayed}\n`;
    report += `Total Tournaments: ${serverStats.totalTournamentsHeld}\n`;
    report += `Server Uptime: ${Math.floor(serverStats.serverUptime / 3600000)}h ${Math.floor((serverStats.serverUptime % 3600000) / 60000)}m\n`;
    report += `Total Eliminations: ${serverStats.totalEliminations}\n`;
    report += `Total Power-ups Collected: ${serverStats.totalPowerUpsCollected}\n\n`;

    // Top Players
    report += '🏆 TOP PLAYERS\n';
    data.leaderboard.slice(0, 5).forEach((player, index) => {
      report += `${index + 1}. ${player.username} - ${player.skillRating.toFixed(0)} SR (${player.winRate.toFixed(1)}% WR)\n`;
    });
    report += '\n';

    // Popular Game Modes
    report += '🎮 POPULAR GAME MODES\n';
    Object.entries(serverStats.popularGameModes)
      .sort(([, a], [, b]) => b - a)
      .forEach(([mode, count]) => {
        report += `${mode}: ${count} games\n`;
      });

    return report;
  }

  // Export data methods
  public exportPlayerStats(): any[] {
    return this._dashboardData.playerStats.map(stats => ({
      username: stats.username,
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      winRate: stats.winRate.toFixed(1) + '%',
      kdRatio: stats.kdRatio.toFixed(2),
      eliminations: stats.totalEliminations,
      catches: stats.totalCatches,
      powerUps: stats.totalPowerUpsCollected,
      bestStreak: stats.bestStreak,
      skillRating: Math.round(stats.skillRating),
      achievements: stats.achievements.length,
    }));
  }

  public exportTournamentStats(): any[] {
    return this._dashboardData.tournamentStats.map(stats => ({
      name: stats.name,
      winner: stats.winner,
      participants: stats.participants,
      duration: Math.floor(stats.duration / 60000) + 'm', // minutes
      matchesPlayed: stats.matchesPlayed,
      completionRate: stats.completionRate.toFixed(1) + '%',
    }));
  }

  // Get helper method for GameManager
  private getPlayerEntity(playerId: string): any {
    return GameManager.instance.getPlayerEntity(playerId);
  }

  // Cleanup
  public cleanup(): void {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = undefined;
    }
    console.log('📊 Statistics Dashboard cleaned up');
  }
}
