import {
  World,
  Player,
  GameServer,
  WorldEvent,
} from 'hytopia';

import DodgeballPlayerEntity from './DodgeballPlayerEntity.ts';
import GameModeManager from './GameModeManager.ts';
import AchievementSystem from './AchievementSystem.ts';
import PowerUpEntity from './PowerUpEntity.ts';
import TournamentManager from './TournamentManager.ts';
import StatisticsDashboard from './StatisticsDashboard.ts';
import SpectatorMode from './SpectatorMode.ts';
import AIOpponent from './AIOpponent.ts';
import SeasonalEvents from './SeasonalEvents.ts';
import VoiceChatManager from './VoiceChatManager.ts';
import {
  GameConfig,
  GameMode,
  GameState,
  Team,
  PowerUpType
} from './GameConfig.ts';



/**
 * 🎯 Ultimate Dodgeball Game Manager
 *
 * Advanced game manager with multiple game modes, power-ups, achievements,
 * and enhanced performance features.
 */
export default class GameManager {
  private static _instance: GameManager;
  
  public static get instance(): GameManager {
    if (!this._instance) {
      this._instance = new GameManager();
    }
    return this._instance;
  }

  // Core game state
  public world: World | undefined;
  private _gameState: GameState = GameState.WAITING;
  private _currentMode: GameMode = GameMode.CLASSIC;
  private _gameStartTime: number = 0;
  private _roundNumber: number = 1;

  // Player management
  private _playerEntities: Map<string, DodgeballPlayerEntity> = new Map();
  private _playerTeams: Map<string, Team> = new Map();
  private _alivePlayers: Map<string, boolean> = new Map();

  // Game systems
  private _gameModeManager: GameModeManager | undefined;
  private _voiceChatManager: VoiceChatManager | undefined;
  private _powerUps: Set<PowerUpEntity> = new Set();
  private _dodgeballs: Set<any> = new Set();

  // Timers and scheduling
  private _roundTimer: NodeJS.Timeout | undefined;
  private _countdownTimer: NodeJS.Timeout | undefined;
  private _powerUpSpawner: NodeJS.Timeout | undefined;
  private _gameLoopTimer: NodeJS.Timeout | undefined;

  // Performance optimization
  private _lastUpdateTime: number = 0;
  private _updateInterval: number = 1000 / 60; // 60 FPS

  private constructor() {
    // Achievement system will be initialized in setupGame
  }

  public setupGame(world: World): void {
    this.world = world;
    console.log('🎯 Ultimate Dodgeball Arena initialized!');

    // Initialize game mode manager
    this._gameModeManager = new GameModeManager(world);

    // Initialize tournament manager
    TournamentManager.instance.initialize(world);

    // Initialize statistics dashboard
    StatisticsDashboard.instance.initialize(world);

    // Initialize spectator mode
    SpectatorMode.instance.initialize(world);

    // Initialize AI opponent system
    AIOpponent.instance.initialize(world);

    // Initialize seasonal events system
    SeasonalEvents.instance.initialize(world);

    // Initialize voice chat system
    this._voiceChatManager = VoiceChatManager.instance;
    this._voiceChatManager.initialize(world);

    // Set up world event handlers
    world.on('tick', ({ deltaTimeMs }) => {
      this.update(deltaTimeMs);
    });

    // Start periodic game state checks
    this._startGameLoop();

    // Initialize achievement system
    AchievementSystem.instance.world = world;

    console.log('✅ All systems initialized and ready!');
  }

  // Enhanced update method called every frame
  public update(deltaTimeMs: number): void {
    const now = Date.now();

    // Throttle updates for performance
    if (now - this._lastUpdateTime < this._updateInterval) {
      return;
    }

    this._lastUpdateTime = now;

    // Update all player entities
    for (const playerEntity of this._playerEntities.values()) {
      playerEntity.update(deltaTimeMs);
    }

    // Update voice chat positions
    if (this._voiceChatManager && this.world) {
      const players = GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world);
      for (const player of players) {
        if (this._playerEntities.has(player.id)) {
          this._voiceChatManager.updatePlayerPosition(player);
        }
      }
    }

    // Update game mode manager
    this._gameModeManager?.update(deltaTimeMs);

    // Update power-ups (check for expiration, etc.)
    this._updatePowerUps();

    // Check for game state changes
    if (this._gameState === GameState.WAITING) {
    this._checkForGameStart();
    } else if (this._gameState === GameState.PLAYING) {
      this._checkForRoundEnd();
    }
  }

  // Start the main game loop
  private _startGameLoop(): void {
    this._gameLoopTimer = setInterval(() => {
      this.update(16); // ~60 FPS
    }, 16);
  }

  public handlePlayerJoin(player: Player): void {
    if (!this.world) return;

    try {
      console.log(`👤 Player ${player.username} joining the arena...`);

      // Create enhanced player entity
    const playerEntity = new DodgeballPlayerEntity(player);
      this._playerEntities.set(player.id, playerEntity);
    
    // Assign team (balance teams)
    const team = this._assignTeam();
    this._playerTeams.set(player.id, team);
      playerEntity.team = team;

      // Mark player as alive
      this._alivePlayers.set(player.id, true);
    
      // Spawn at team's side with safety check
      const spawnPos = this._getSafeSpawnPosition(team);
    playerEntity.spawn(this.world, spawnPos);

      // Load enhanced UI
    player.ui.load('ui/index.html');

      // Send enhanced welcome messages
      this.world.chatManager.sendPlayerMessage(
        player,
        `🎯 Welcome to Ultimate Dodgeball Arena, ${player.username}!`,
        '00FF00'
      );

    this.world.chatManager.sendPlayerMessage(
      player,
        `🏐 You're on the ${team === Team.RED ? '🔴 RED' : '🔵 BLUE'} team!`,
      team === Team.RED ? 'FF0000' : '0000FF'
    );

      // Initialize achievement tracking for this player
      AchievementSystem.instance.initializePlayer(player);

      // Initialize voice chat for this player
      if (this._voiceChatManager) {
        this._voiceChatManager.initializePlayerVoice(player);
      }

      // Update UI with comprehensive game state
    this._updatePlayerUI(player);

      // Announce player join to all players
      this.world.chatManager.sendBroadcastMessage(
        `${player.username} joined the ${team === Team.RED ? '🔴 RED' : '🔵 BLUE'} team!`,
        team === Team.RED ? 'FF0000' : '0000FF'
      );

      console.log(`✅ Player ${player.username} successfully joined team ${team}`);
    
    // Check if we can start a game
    this._checkForGameStart();

    } catch (error) {
      console.error(`❌ Failed to initialize player ${player.username}:`, error);
      this.world.chatManager.sendPlayerMessage(
        player,
        'Failed to join game. Please try reconnecting.',
        'FF0000'
      );
    }
  }

  // Update power-ups each frame
  private _updatePowerUps(): void {
    // Clean up expired power-ups
    for (const powerUp of this._powerUps) {
      if (!powerUp.isSpawned) {
        this._powerUps.delete(powerUp);
      }
    }
  }

  public handlePlayerLeave(player: Player): void {
    if (!this.world) return;

    console.log(`👋 Player ${player.username} leaving the arena...`);

    try {
      // Get and clean up player entity
      const playerEntity = this._playerEntities.get(player.id);
      if (playerEntity) {
        playerEntity.despawn();
        this._playerEntities.delete(player.id);
      }

      // Clean up any remaining player entities
    this.world.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach(entity => entity.despawn());

    // Remove from teams and alive players
    this._playerTeams.delete(player.id);
    this._alivePlayers.delete(player.id);

      // Clean up voice chat for this player
      if (this._voiceChatManager) {
        this._voiceChatManager.removePlayer(player.id);
      }

      // Record player leave for achievements
      AchievementSystem.instance.endMatch(player, false, false);

      // Announce player departure
      this.world.chatManager.sendBroadcastMessage(
        `${player.username} left the arena`,
        'FFFF00'
      );

      // Check if game should end due to insufficient players
    if (this._gameState === GameState.PLAYING) {
      this._checkForRoundEnd();
    }

      console.log(`✅ Player ${player.username} successfully removed from game`);

    } catch (error) {
      console.error(`❌ Error handling player leave for ${player.username}:`, error);
    }
  }



  // Spawn a random power-up
  private spawnRandomPowerUp(): void {
    if (!this.world || this._powerUps.size >= GameConfig.POWER_UP_MAX_ACTIVE) return;

    // Get all available power-up types
    const powerUpTypes = Object.values(PowerUpType);

    // Select random power-up type
    const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

    if (!randomType) {
      console.error('❌ Failed to select random power-up type');
      return;
    }

    // Generate random spawn position within arena bounds
    const spawnX = Math.random() * (GameConfig.FIELD_MAX_X - GameConfig.FIELD_MIN_X) + GameConfig.FIELD_MIN_X;
    const spawnZ = Math.random() * (GameConfig.FIELD_MAX_Z - GameConfig.FIELD_MIN_Z) + GameConfig.FIELD_MIN_Z;

    const spawnPosition = { x: spawnX, y: 2, z: spawnZ };

    // Create and spawn power-up
    const powerUp = new PowerUpEntity(randomType);
    powerUp.spawn(this.world, spawnPosition);
    this._powerUps.add(powerUp);

    console.log(`⚡ Spawned ${randomType} power-up at (${spawnX.toFixed(1)}, ${spawnZ.toFixed(1)})`);
  }

  // Start power-up spawning system
  private startPowerUpSpawner(): void {
    if (this._powerUpSpawner) {
      clearInterval(this._powerUpSpawner);
    }

    this._powerUpSpawner = setInterval(() => {
      this.spawnRandomPowerUp();
    }, GameConfig.POWER_UP_SPAWN_RATE_MS);

    console.log('⚡ Power-up spawning system activated');
  }

  // Stop power-up spawning
  private stopPowerUpSpawner(): void {
    if (this._powerUpSpawner) {
      clearInterval(this._powerUpSpawner);
      this._powerUpSpawner = undefined;
    }
  }

  // Update all players' UI
  private _updateAllPlayersUI(): void {
    if (!this.world) return;
    
    const players = GameServer.instance.playerManager
      .getConnectedPlayersByWorld(this.world);

    players.forEach(player => this._updatePlayerUI(player));
  }

  private _assignTeam(): Team {
    const redCount = Array.from(this._playerTeams.values())
      .filter(team => team === Team.RED).length;
    const blueCount = Array.from(this._playerTeams.values())
      .filter(team => team === Team.BLUE).length;
    
    return redCount <= blueCount ? Team.RED : Team.BLUE;
  }

  private _getSafeSpawnPosition(team: Team): { x: number, y: number, z: number } {
    // Define spawn areas for each team with safety margins
    const redSpawnArea = {
      minX: GameConfig.FIELD_MIN_X + GameConfig.SPAWN_SAFE_RADIUS,
      maxX: 0 - GameConfig.SPAWN_SAFE_RADIUS,
      minZ: GameConfig.FIELD_MIN_Z + GameConfig.SPAWN_SAFE_RADIUS,
      maxZ: GameConfig.FIELD_MAX_Z - GameConfig.SPAWN_SAFE_RADIUS,
    };

    const blueSpawnArea = {
      minX: 0 + GameConfig.SPAWN_SAFE_RADIUS,
      maxX: GameConfig.FIELD_MAX_X - GameConfig.SPAWN_SAFE_RADIUS,
      minZ: GameConfig.FIELD_MIN_Z + GameConfig.SPAWN_SAFE_RADIUS,
      maxZ: GameConfig.FIELD_MAX_Z - GameConfig.SPAWN_SAFE_RADIUS,
    };

    const spawnArea = team === Team.RED ? redSpawnArea : blueSpawnArea;

    // Generate random position within team's spawn area
    const x = Math.random() * (spawnArea.maxX - spawnArea.minX) + spawnArea.minX;
    const z = Math.random() * (spawnArea.maxZ - spawnArea.minZ) + spawnArea.minZ;

      return {
      x: Math.round(x * 10) / 10, // Round to 1 decimal place
      y: 2,
      z: Math.round(z * 10) / 10,
    };
  }

  // Get current game statistics
  public getGameStats(): any {
    const totalPlayers = this._playerTeams.size;
    const alivePlayers = Array.from(this._alivePlayers.values()).filter(alive => alive).length;
    const redPlayers = Array.from(this._playerTeams.values()).filter(team => team === Team.RED).length;
    const bluePlayers = Array.from(this._playerTeams.values()).filter(team => team === Team.BLUE).length;
    const redAlive = Array.from(this._playerTeams.entries())
      .filter(([playerId, team]) => team === Team.RED && this._alivePlayers.get(playerId))
      .length;
    const blueAlive = Array.from(this._playerTeams.entries())
      .filter(([playerId, team]) => team === Team.BLUE && this._alivePlayers.get(playerId))
      .length;

      return {
      gameState: this._gameState,
      currentMode: this._currentMode,
      roundNumber: this._roundNumber,
      totalPlayers,
      alivePlayers,
      redPlayers,
      bluePlayers,
      redAlive,
      blueAlive,
      activePowerUps: this._powerUps.size,
      gameTime: this._gameStartTime > 0 ? Date.now() - this._gameStartTime : 0,
    };
  }

  // Clean up all game resources
  public cleanup(): void {
    console.log('🧹 Cleaning up Ultimate Dodgeball Arena...');

    // Clear all timers
    if (this._roundTimer) {
      clearTimeout(this._roundTimer);
      this._roundTimer = undefined;
    }
    if (this._countdownTimer) {
      clearTimeout(this._countdownTimer);
      this._countdownTimer = undefined;
    }
    if (this._powerUpSpawner) {
      clearInterval(this._powerUpSpawner);
      this._powerUpSpawner = undefined;
    }
    if (this._gameLoopTimer) {
      clearInterval(this._gameLoopTimer);
      this._gameLoopTimer = undefined;
    }

    // Clean up power-ups
    this._powerUps.forEach(powerUp => {
      if (powerUp.isSpawned) {
        powerUp.despawn();
      }
    });
    this._powerUps.clear();

    // Clean up game mode manager
    this._gameModeManager?.cleanup();

    // Clean up statistics dashboard
    StatisticsDashboard.instance.cleanup();

    // Clean up spectator mode
    SpectatorMode.instance.cleanup();

    // Clean up AI opponents
    AIOpponent.instance.cleanup();

    // Clean up seasonal events
    SeasonalEvents.instance.cleanup();

    // Clean up voice chat
    this._voiceChatManager?.cleanup();

    // Reset game state
    this._gameState = GameState.WAITING;
    this._gameStartTime = 0;
    this._roundNumber = 1;

    console.log('✅ Cleanup completed');
  }

  // Tournament management methods
  public createTournament(name: string, maxPlayers: number = 16): boolean {
    try {
      const tournament = TournamentManager.instance.createTournament(
        name,
        'single_elimination' as any,
        maxPlayers,
        1, // players per team
        0 // entry fee
      );
      return true;
    } catch (error) {
      console.error('❌ Failed to create tournament:', error);
      return false;
    }
  }

  public startTournamentRegistration(): boolean {
    return TournamentManager.instance.openRegistration();
  }

  public stopTournamentRegistration(): boolean {
    return TournamentManager.instance.closeRegistration();
  }

  public registerPlayerForTournament(player: Player): boolean {
    return TournamentManager.instance.registerPlayer(player);
  }

  public cancelTournament(): void {
    TournamentManager.instance.cancelTournament();
  }

  public getTournamentStats(): any {
    return TournamentManager.instance.getTournamentStats();
  }

  // Enhanced elimination method for tournament support
  public eliminatePlayer(player: Player): void {
    const playerEntity = this._playerEntities.get(player.id);
    if (!playerEntity) return;

    // Check if player has shield protection
    if (playerEntity.shield > 0) {
      // Shield absorbs the elimination
      console.log(`🛡️ ${player.username}'s shield absorbed the elimination!`);
      return;
    }

    // Mark player as eliminated
    this._alivePlayers.set(player.id, false);

    if (!this.world) return;

    // Record elimination for achievements
    AchievementSystem.instance.recordElimination(player, 'unknown'); // Could track who eliminated them

    // Enhanced elimination message with team colors
    const team = this._playerTeams.get(player.id);
    const teamEmoji = team === Team.RED ? '🔴' : '🔵';

    this.world.chatManager.sendBroadcastMessage(
      `${teamEmoji} ${player.username} has been eliminated!`,
      'FFFF00'
    );

    // Update UI for all players
    this._updateAllPlayersUI();

    // Check for round end
    this._checkForRoundEnd();
  }

  // Get comprehensive game statistics
  public getComprehensiveStats(): any {
    const baseStats = this.getGameStats();

    return {
      ...baseStats,
      tournamentStats: this.getTournamentStats(),
      playerStats: Array.from(this._playerEntities.values()).map(entity => ({
        username: entity.player.username,
        health: entity.health,
        shield: entity.shield,
        eliminations: entity.stats.eliminations,
        catches: entity.stats.catches,
        powerUps: entity.stats.powerUpsCollected,
        activePowerUps: entity.activePowerUps,
      })),
      systemStats: {
        powerUpsActive: this._powerUps.size,
        dodgeballsActive: this._dodgeballs.size,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };
  }

  // Statistics dashboard methods
  public getDashboardData(): any {
    return StatisticsDashboard.instance.getDashboardData();
  }

  public getLeaderboard(limit: number = 10): any[] {
    return StatisticsDashboard.instance.getLeaderboard(limit);
  }

  public getPlayerStats(playerId: string): any {
    return StatisticsDashboard.instance.getPlayerStats(playerId);
  }

  public getServerStats(): any {
    return StatisticsDashboard.instance.getServerStats();
  }

  public getGameModeStats(): any {
    return StatisticsDashboard.instance.getGameModeStats();
  }

  public generateStatisticsReport(): string {
    return StatisticsDashboard.instance.generateReport();
  }

  public exportPlayerStats(): any[] {
    return StatisticsDashboard.instance.exportPlayerStats();
  }

  public exportTournamentStats(): any[] {
    return StatisticsDashboard.instance.exportTournamentStats();
  }

  // Helper method to get player entity (used by StatisticsDashboard)
  public getPlayerEntity(playerId: string): DodgeballPlayerEntity | undefined {
    return this._playerEntities.get(playerId);
  }

  // Spectator mode methods
  public enableSpectatorMode(player: Player, matchId?: string): boolean {
    return SpectatorMode.instance.enableSpectatorMode(player, matchId);
  }

  public disableSpectatorMode(player: Player): boolean {
    return SpectatorMode.instance.disableSpectatorMode(player);
  }

  public changeSpectatorCameraMode(player: Player, mode: any): boolean {
    return SpectatorMode.instance.changeCameraMode(player, mode);
  }

  public setSpectatorFollowTarget(player: Player, targetPlayer: Player): boolean {
    return SpectatorMode.instance.setFollowTarget(player, targetPlayer);
  }

  public updateSpectatorPreferences(player: Player, preferences: any): boolean {
    return SpectatorMode.instance.updatePreferences(player, preferences);
  }

  public isPlayerSpectating(playerId: string): boolean {
    return SpectatorMode.instance.isPlayerSpectating(playerId);
  }

  public getSpectatorCount(): number {
    return SpectatorMode.instance.getSpectatorCount();
  }

  public getSpectatorStats(): any {
    return SpectatorMode.instance.getSpectatorStats();
  }

  // AI opponent methods
  public createAIOpponent(name: string, team: Team, difficulty?: any, behavior?: any): any {
    return AIOpponent.instance.createAIOpponent(name, team, difficulty, behavior);
  }

  public removeAIOpponent(playerId: string): boolean {
    return AIOpponent.instance.removeAIOpponent(playerId);
  }

  public getAIPlayers(): any[] {
    return AIOpponent.instance.getAIPlayers();
  }

  public getAIPlayerCount(): number {
    return AIOpponent.instance.getAIPlayerCount();
  }

  public getAIStats(): any {
    return AIOpponent.instance.getAIStats();
  }

  public fillWithAIOpponents(targetPlayerCount: number = 8): number {
    const currentPlayers = this._playerTeams.size;
    const aiNeeded = Math.max(0, targetPlayerCount - currentPlayers);

    if (aiNeeded === 0) return 0;

    let aiCreated = 0;
    const difficulties = ['easy', 'medium', 'hard'];
    const behaviors = ['balanced', 'aggressive', 'defensive'];

    for (let i = 0; i < aiNeeded; i++) {
      const team = i % 2 === 0 ? Team.RED : Team.BLUE;
      const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
      const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];

      const aiName = `AI_Bot_${i + 1}`;
      const aiPlayer = this.createAIOpponent(aiName, team, difficulty, behavior);

      if (aiPlayer) {
        aiCreated++;
        console.log(`🤖 Added AI opponent: ${aiName} (${difficulty}, ${behavior})`);
      }
    }

    return aiCreated;
  }

  // Seasonal events methods
  public getCurrentSeason(): any {
    return SeasonalEvents.instance.getCurrentSeason();
  }

  public getSeasonalTheme(): any {
    return SeasonalEvents.instance.getSeasonalTheme();
  }

  public getActiveEvents(): any[] {
    return SeasonalEvents.instance.getActiveEvents();
  }

  public getEventById(eventId: string): any {
    return SeasonalEvents.instance.getEventById(eventId);
  }

  public participateInEvent(player: Player, eventId: string): boolean {
    return SeasonalEvents.instance.participateInEvent(player, eventId);
  }

  public getSeasonalStats(): any {
    return SeasonalEvents.instance.getSeasonalStats();
  }

  private _checkForGameStart(): void {
    if (!this.world || this._gameState !== GameState.WAITING) return;

    const players = GameServer.instance.playerManager
      .getConnectedPlayersByWorld(this.world);
    
    if (players.length >= GameConfig.MIN_PLAYERS_TO_START) {
      this._startCountdown();
    }
  }

  private _startCountdown(): void {
    if (!this.world) return;

    this._gameState = GameState.STARTING;
    
    let countdown = GameConfig.COUNTDOWN_SECONDS;
    
    this._countdownTimer = setInterval(() => {
      if (!this.world) return;
      
      if (countdown > 0) {
        this.world.chatManager.sendBroadcastMessage(
          `Game starting in ${countdown}...`,
          '00FF00'
        );
        countdown--;
      } else {
        clearInterval(this._countdownTimer);
        this._startRound();
      }
    }, 1000);
  }

  private _startRound(): void {
    if (!this.world) return;

    this._gameState = GameState.PLAYING;
    
    // Reset all players to alive
    this._playerTeams.forEach((team, playerId) => {
      this._alivePlayers.set(playerId, true);
    });

    // Spawn dodgeballs on the center line
    this._spawnDodgeballs();

    // Start round timer
    this._roundTimer = setTimeout(() => {
      this._endRound(null); // Time ran out, it's a draw
    }, GameConfig.ROUND_TIME_MS);

    this.world.chatManager.sendBroadcastMessage(
      'ROUND START! GO!',
      '00FF00'
    );

    // Update all UIs
    this._updateAllPlayersUI();
  }

  private _spawnDodgeballs(): void {
    if (!this.world) return;
    
    console.log('Spawning dodgeballs at center line...');
    
    // Import DodgeballEntity dynamically to avoid circular imports
    import('./DodgeballEntity.ts').then(({ default: DodgeballEntity }) => {
      if (!this.world) return;

      // Spawn dodgeballs along the center line (z = 0)
      for (let i = 0; i < GameConfig.DODGEBALL_COUNT; i++) {
        const dodgeball = new DodgeballEntity();
        
        // Space them out along the center line
        const spacing = 3;
        const startX = -(GameConfig.DODGEBALL_COUNT - 1) * spacing / 2;
        
        const spawnPosition = {
          x: startX + (i * spacing),
          y: 2,
          z: GameConfig.FIELD_CENTER_Z,
        };
        
        dodgeball.spawn(this.world, spawnPosition);
      }
    });
  }

  private _checkForRoundEnd(): void {
    if (!this.world || this._gameState !== GameState.PLAYING) return;

    const aliveRed = Array.from(this._playerTeams.entries())
      .filter(([playerId, team]) => 
        team === Team.RED && this._alivePlayers.get(playerId)
      ).length;

    const aliveBlue = Array.from(this._playerTeams.entries())
      .filter(([playerId, team]) => 
        team === Team.BLUE && this._alivePlayers.get(playerId)
      ).length;

    if (aliveRed === 0) {
      this._endRound(Team.BLUE);
    } else if (aliveBlue === 0) {
      this._endRound(Team.RED);
    }
  }

  private _endRound(winner: Team | null): void {
    if (!this.world) return;

    this._gameState = GameState.ENDING;
    
    // Clear timers
    if (this._roundTimer) {
      clearTimeout(this._roundTimer);
      this._roundTimer = undefined;
    }

    // Announce winner
    if (winner) {
      this.world.chatManager.sendBroadcastMessage(
        `${winner === Team.RED ? 'RED' : 'BLUE'} TEAM WINS!`,
        winner === Team.RED ? 'FF0000' : '0000FF'
      );
    } else {
      this.world.chatManager.sendBroadcastMessage(
        'TIME\'S UP! DRAW!',
        'FFFF00'
      );
    }

    // Reset after delay
    setTimeout(() => {
      this._resetGame();
    }, GameConfig.ROUND_END_DELAY_MS);
  }

  private _resetGame(): void {
    this._gameState = GameState.WAITING;
    this._alivePlayers.clear();
    
    // Check if we can start another round
    this._checkForGameStart();
  }

  private _updatePlayerUI(player: Player): void {
    const team = this._playerTeams.get(player.id);
    const isAlive = this._alivePlayers.get(player.id) ?? true;

    player.ui.sendData({
      type: 'game-update',
      gameState: this._gameState,
      team: team,
      isAlive: isAlive,
      redAlive: this._getTeamAliveCount(Team.RED),
      blueAlive: this._getTeamAliveCount(Team.BLUE),
    });
  }



  private _getTeamAliveCount(team: Team): number {
    return Array.from(this._playerTeams.entries())
      .filter(([playerId, t]) => 
        t === team && (this._alivePlayers.get(playerId) ?? false)
      ).length;
  }

  // Touch Input Methods
  public handleTouchInput(player: Player, joystick: { x: number; y: number }, buttons: any): void {
    if (!this.world) return;

    const playerEntity = this._playerEntities.get(player.id);
    if (!playerEntity) return;

    // Handle joystick movement
    if (joystick.x !== 0 || joystick.y !== 0) {
      // Apply force to player entity for movement
      const moveForce = {
        x: joystick.x * 50, // Adjust force multiplier as needed
        y: 0,
        z: joystick.y * 50
      };

      // Apply impulse for immediate movement response
      if (playerEntity.rawRigidBody) {
        playerEntity.rawRigidBody.applyImpulse(moveForce);
      }
    }

    // Handle button presses
    if (buttons.throw) {
      playerEntity.handleThrow();
    }

    if (buttons.catch) {
      playerEntity.handleCatch();
    }

    if (buttons.dash) {
      playerEntity.handleDash();
    }
  }

  // Voice Chat Methods
  public handleVoiceMessage(player: Player, audioUri: string, duration: number): boolean {
    if (!this._voiceChatManager) return false;
    return this._voiceChatManager.handleVoiceMessage(player, audioUri, duration);
  }

  public togglePlayerMute(playerId: string): boolean {
    if (!this._voiceChatManager) return false;
    return this._voiceChatManager.toggleMute(playerId);
  }

  public togglePlayerDeafen(playerId: string): boolean {
    if (!this._voiceChatManager) return false;
    return this._voiceChatManager.toggleDeafen(playerId);
  }

  public setPlayerVoiceMode(playerId: string, mode: any): boolean {
    if (!this._voiceChatManager) return false;
    return this._voiceChatManager.setVoiceMode(playerId, mode);
  }

  public getPlayerVoiceSettings(playerId: string): any {
    if (!this._voiceChatManager) return null;
    return this._voiceChatManager.getPlayerSettings(playerId);
  }

  public getVoiceStats(): any {
    if (!this._voiceChatManager) return null;
    return this._voiceChatManager.getVoiceStats();
  }
}