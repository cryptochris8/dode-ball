/**
 * 🎮 Game Mode Manager
 *
 * Handles different game modes with their unique rules, mechanics, and victory conditions.
 */

import {
  World,
  Player,
} from 'hytopia';

import {
  GameMode,
  GameConfig,
  GameState,
  Team,
} from './GameConfig.ts';
import DodgeballPlayerEntity from './DodgeballPlayerEntity.ts';
import PowerUpEntity from './PowerUpEntity.ts';
import AchievementSystem from './AchievementSystem.ts';

export default class GameModeManager {
  private _world: World | undefined;
  private _currentMode: GameMode = GameMode.CLASSIC;
  private _modeStartTime: number = 0;
  private _powerUpSpawner: NodeJS.Timeout | undefined;
  private _randomEventTimer: NodeJS.Timeout | undefined;
  private _modeSpecificData: Map<string, any> = new Map();

  constructor(world: World) {
    this._world = world;
    AchievementSystem.instance.world = world;
  }

  // Initialize a game mode
  public initializeMode(mode: GameMode): void {
    console.log(`🎮 Initializing game mode: ${mode}`);
    this._currentMode = mode;
    this._modeStartTime = Date.now();
    this._modeSpecificData.clear();

    // Set up mode-specific features
    switch (mode) {
      case GameMode.CLASSIC:
        this.setupClassicMode();
        break;
      case GameMode.SURVIVAL:
        this.setupSurvivalMode();
        break;
      case GameMode.TIME_ATTACK:
        this.setupTimeAttackMode();
        break;
      case GameMode.POWER_UP_MADNESS:
        this.setupPowerUpMadnessMode();
        break;
      case GameMode.CHAOS:
        this.setupChaosMode();
        break;
    }
  }

  // Set up Classic Mode
  private setupClassicMode(): void {
    console.log('🏐 Classic Dodgeball Mode - Traditional team-based gameplay');

    // Enable standard power-ups
    if (GameConfig.GAME_MODES[GameMode.CLASSIC].powerUpsEnabled) {
      this.startPowerUpSpawner(GameConfig.POWER_UP_SPAWN_RATE_MS);
    }

    this._modeSpecificData.set('roundsPlayed', 0);
    this._modeSpecificData.set('maxRounds', 3);
  }

  // Set up Survival Mode
  private setupSurvivalMode(): void {
    console.log('⚔️ Survival Mode - Last team standing wins!');

    // Enable power-ups and special abilities
    this.startPowerUpSpawner(GameConfig.POWER_UP_SPAWN_RATE_MS);
    this.enableSpecialAbilities();

    this._modeSpecificData.set('currentRound', 1);
    this._modeSpecificData.set('maxRounds', GameConfig.GAME_MODES[GameMode.SURVIVAL].maxRounds);
    this._modeSpecificData.set('eliminatedPlayers', new Set<string>());
  }

  // Set up Time Attack Mode
  private setupTimeAttackMode(): void {
    console.log('⏱️ Time Attack Mode - Score as many eliminations as possible!');

    // Disable power-ups for pure skill-based gameplay
    // Enable respawning for continuous action
    this.enableRespawning();

    this._modeSpecificData.set('timeLimit', GameConfig.GAME_MODES[GameMode.TIME_ATTACK].timeLimit);
    this._modeSpecificData.set('scores', new Map<string, number>());
  }

  // Set up Power-up Madness Mode
  private setupPowerUpMadnessMode(): void {
    console.log('🎉 Power-up Madness - Chaos with frequent power-ups!');

    const powerUpRate = GameConfig.GAME_MODES[GameMode.POWER_UP_MADNESS].powerUpSpawnRate || 8000;
    this.startPowerUpSpawner(powerUpRate);
    this.enableSpecialAbilities();

    this._modeSpecificData.set('powerUpsSpawned', 0);
    this._modeSpecificData.set('specialAbilitiesUsed', 0);
  }

  // Set up Chaos Mode
  private setupChaosMode(): void {
    console.log('🎲 Chaos Mode - Random events and unpredictable gameplay!');

    this.startPowerUpSpawner(GameConfig.POWER_UP_SPAWN_RATE_MS);
    this.enableSpecialAbilities();
    this.startRandomEvents();

    this._modeSpecificData.set('randomEventsTriggered', 0);
    this._modeSpecificData.set('chaosLevel', 1);
  }

  // Start power-up spawner
  private startPowerUpSpawner(intervalMs: number): void {
    this._powerUpSpawner = setInterval(() => {
      this.spawnRandomPowerUp();
    }, intervalMs);
  }

  // Enable special abilities for players
  private enableSpecialAbilities(): void {
    // This would be implemented when enhancing player entities
    console.log('✨ Special abilities enabled for all players');
  }

  // Enable respawning for continuous gameplay
  private enableRespawning(): void {
    console.log('🔄 Respawning enabled - players can respawn after elimination');
  }

  // Start random events for Chaos mode
  private startRandomEvents(): void {
    const eventInterval = GameConfig.GAME_MODES[GameMode.CHAOS].randomEventsInterval || 10000;

    this._randomEventTimer = setInterval(() => {
      this.triggerRandomEvent();
    }, eventInterval);
  }

  // Spawn a random power-up
  private spawnRandomPowerUp(): void {
    if (!this._world) return;

    // Get all available power-up types
    const powerUpTypes = Object.values(PowerUpType);

    // Select random power-up type
    const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

    // Generate random spawn position within arena bounds
    const spawnX = Math.random() * (GameConfig.FIELD_MAX_X - GameConfig.FIELD_MIN_X) + GameConfig.FIELD_MIN_X;
    const spawnZ = Math.random() * (GameConfig.FIELD_MAX_Z - GameConfig.FIELD_MIN_Z) + GameConfig.FIELD_MIN_Z;

    const spawnPosition = { x: spawnX, y: 2, z: spawnZ };

    // Create and spawn power-up
    const powerUp = new PowerUpEntity(randomType);
    powerUp.spawn(this._world, spawnPosition);

    console.log(`⚡ Spawned ${randomType} power-up at (${spawnX.toFixed(1)}, ${spawnZ.toFixed(1)})`);
  }

  // Trigger a random event in Chaos mode
  private triggerRandomEvent(): void {
    if (!this._world) return;

    const events = [
      'speed_boost_all',
      'slow_motion',
      'extra_power_ups',
      'random_teleport',
      'invisibility_all',
      'gravity_change',
    ];

    const randomEvent = events[Math.floor(Math.random() * events.length)];

    switch (randomEvent) {
      case 'speed_boost_all':
        this.applyGlobalSpeedBoost();
        break;
      case 'slow_motion':
        this.applySlowMotion();
        break;
      case 'extra_power_ups':
        this.spawnMultiplePowerUps();
        break;
      case 'random_teleport':
        this.randomTeleportPlayers();
        break;
      case 'invisibility_all':
        this.applyGlobalInvisibility();
        break;
      case 'gravity_change':
        this.changeGravity();
        break;
    }

    const eventCount = this._modeSpecificData.get('randomEventsTriggered') || 0;
    this._modeSpecificData.set('randomEventsTriggered', eventCount + 1);
  }

  // Random event implementations
  private applyGlobalSpeedBoost(): void {
    console.log('🚀 CHAOS EVENT: Speed Boost for everyone!');
    this._world?.chatManager.sendBroadcastMessage('🚀 CHAOS: Speed Boost for 10 seconds!', 'FFD700');
    // Implementation would apply speed boost to all players
  }

  private applySlowMotion(): void {
    console.log('⏰ CHAOS EVENT: Slow Motion!');
    this._world?.chatManager.sendBroadcastMessage('⏰ CHAOS: Time Slow for 8 seconds!', '00CED1');
    // Implementation would slow down time
  }

  private spawnMultiplePowerUps(): void {
    console.log('🎁 CHAOS EVENT: Power-up Bonanza!');
    this._world?.chatManager.sendBroadcastMessage('🎁 CHAOS: Multiple power-ups spawning!', 'FF69B4');
    // Spawn 3-5 power-ups at once
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.spawnRandomPowerUp(), i * 500);
    }
  }

  private randomTeleportPlayers(): void {
    console.log('✨ CHAOS EVENT: Random Teleport!');
    this._world?.chatManager.sendBroadcastMessage('✨ CHAOS: Random teleportation!', '9932CC');
    // Implementation would teleport random players
  }

  private applyGlobalInvisibility(): void {
    console.log('👻 CHAOS EVENT: Mass Invisibility!');
    this._world?.chatManager.sendBroadcastMessage('👻 CHAOS: Everyone is invisible!', '8A2BE2');
    // Implementation would make all players invisible
  }

  private changeGravity(): void {
    console.log('🌍 CHAOS EVENT: Gravity Shift!');
    this._world?.chatManager.sendBroadcastMessage('🌍 CHAOS: Gravity changed!', '32CD32');
    // Implementation would change world gravity temporarily
  }

  // Handle mode-specific victory conditions
  public checkVictoryCondition(alivePlayers: Map<string, boolean>, playerTeams: Map<string, Team>): Team | null {
    switch (this._currentMode) {
      case GameMode.CLASSIC:
      case GameMode.POWER_UP_MADNESS:
        return this.checkTeamEliminationVictory(alivePlayers, playerTeams);

      case GameMode.SURVIVAL:
        return this.checkSurvivalVictory(alivePlayers, playerTeams);

      case GameMode.TIME_ATTACK:
        return this.checkTimeAttackVictory();

      case GameMode.CHAOS:
        return this.checkTeamEliminationVictory(alivePlayers, playerTeams);

      default:
        return null;
    }
  }

  // Check for team elimination victory
  private checkTeamEliminationVictory(alivePlayers: Map<string, boolean>, playerTeams: Map<string, Team>): Team | null {
    const aliveRed = Array.from(alivePlayers.entries())
      .filter(([playerId, alive]) => alive && playerTeams.get(playerId) === Team.RED).length;

    const aliveBlue = Array.from(alivePlayers.entries())
      .filter(([playerId, alive]) => alive && playerTeams.get(playerId) === Team.BLUE).length;

    if (aliveRed === 0 && aliveBlue > 0) return Team.BLUE;
    if (aliveBlue === 0 && aliveRed > 0) return Team.RED;

    return null;
  }

  // Check for survival mode victory
  private checkSurvivalVictory(alivePlayers: Map<string, boolean>, playerTeams: Map<string, Team>): Team | null {
    // Similar to classic but with round progression
    const winner = this.checkTeamEliminationVictory(alivePlayers, playerTeams);
    if (winner) {
      const currentRound = this._modeSpecificData.get('currentRound') || 1;
      const maxRounds = this._modeSpecificData.get('maxRounds') || 5;

      if (currentRound < maxRounds) {
        // Start next round
        this._modeSpecificData.set('currentRound', currentRound + 1);
        return null; // Continue to next round
      }
    }
    return winner;
  }

  // Check for time attack victory
  private checkTimeAttackVictory(): Team | null {
    const timeLimit = this._modeSpecificData.get('timeLimit') || 120000;
    const elapsed = Date.now() - this._modeStartTime;

    if (elapsed >= timeLimit) {
      // Time's up - determine winner by score
      const scores = this._modeSpecificData.get('scores') || new Map();

      let maxScore = 0;
      let winner: Team | null = null;

      for (const [playerId, score] of scores) {
        if (score > maxScore) {
          maxScore = score;
          // In time attack, we don't care about teams - just the player with highest score
          winner = Team.RED; // Placeholder - you'd need to track individual winners
        }
      }

      return winner;
    }

    return null; // Time still running
  }

  // Handle player elimination in different modes
  public handlePlayerElimination(player: Player, alivePlayers: Map<string, boolean>): void {
    switch (this._currentMode) {
      case GameMode.TIME_ATTACK:
        // In time attack, players respawn immediately
        setTimeout(() => {
          alivePlayers.set(player.id, true);
          // Respawn logic would go here
        }, GameConfig.PLAYER_RESPAWN_TIME_MS);
        break;

      case GameMode.SURVIVAL:
        const eliminated = this._modeSpecificData.get('eliminatedPlayers') || new Set();
        eliminated.add(player.id);
        this._modeSpecificData.set('eliminatedPlayers', eliminated);
        break;

      default:
        // Standard elimination
        break;
    }
  }

  // Update method called every frame
  public update(deltaTimeMs: number): void {
    // Handle mode-specific updates
    switch (this._currentMode) {
      case GameMode.TIME_ATTACK:
        this.updateTimeAttack(deltaTimeMs);
        break;
      case GameMode.CHAOS:
        this.updateChaos(deltaTimeMs);
        break;
    }
  }

  // Update time attack mode
  private updateTimeAttack(deltaTimeMs: number): void {
    // Update scores based on survival time
    const scores = this._modeSpecificData.get('scores') || new Map();

    // This would need access to alive players to update scores
    // Implementation would track survival time for each player
  }

  // Update chaos mode
  private updateChaos(deltaTimeMs: number): void {
    // Increase chaos level over time
    const elapsed = Date.now() - this._modeStartTime;
    const chaosLevel = Math.min(5, Math.floor(elapsed / 60000) + 1); // Increase every minute

    if (chaosLevel !== this._modeSpecificData.get('chaosLevel')) {
      this._modeSpecificData.set('chaosLevel', chaosLevel);
      this._world?.chatManager.sendBroadcastMessage(`🎲 Chaos Level ${chaosLevel}!`, 'FF4500');
    }
  }

  // Clean up when mode ends
  public cleanup(): void {
    if (this._powerUpSpawner) {
      clearInterval(this._powerUpSpawner);
      this._powerUpSpawner = undefined;
    }

    if (this._randomEventTimer) {
      clearInterval(this._randomEventTimer);
      this._randomEventTimer = undefined;
    }

    console.log(`🧹 Cleaned up ${this._currentMode} mode`);
  }

  // Get current mode info
  public getCurrentModeInfo(): any {
    return {
      mode: this._currentMode,
      name: GameConfig.GAME_MODES[this._currentMode]?.name || 'Unknown',
      description: GameConfig.GAME_MODES[this._currentMode]?.description || '',
      timeElapsed: Date.now() - this._modeStartTime,
      specificData: Object.fromEntries(this._modeSpecificData),
    };
  }
}
