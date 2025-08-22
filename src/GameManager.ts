import {
  World,
  Player,
  GameServer,
} from 'hytopia';

import DodgeballPlayerEntity from './DodgeballPlayerEntity';
import { GameConfig } from './GameConfig';

export enum GameState {
  WAITING = 'waiting',
  STARTING = 'starting',
  PLAYING = 'playing',
  ENDING = 'ending',
}

export enum Team {
  RED = 'red',
  BLUE = 'blue',
}

export default class GameManager {
  private static _instance: GameManager;
  
  public static get instance(): GameManager {
    if (!this._instance) {
      this._instance = new GameManager();
    }
    return this._instance;
  }

  public world: World | undefined;
  private _gameState: GameState = GameState.WAITING;
  private _playerTeams: Map<string, Team> = new Map();
  private _alivePlayers: Map<string, boolean> = new Map();
  private _roundTimer: NodeJS.Timeout | undefined;
  private _countdownTimer: NodeJS.Timeout | undefined;

  private constructor() {}

  public setupGame(world: World): void {
    this.world = world;
    console.log('Dodgeball game initialized!');
    
    // Check if we have enough players to start periodically
    this._checkForGameStart();
  }

  public handlePlayerJoin(player: Player): void {
    if (!this.world) return;

    // Create player entity
    const playerEntity = new DodgeballPlayerEntity(player);
    
    // Assign team (balance teams)
    const team = this._assignTeam();
    this._playerTeams.set(player.id, team);
    
    // Spawn at team's side
    const spawnPos = this._getTeamSpawnPosition(team);
    playerEntity.spawn(this.world, spawnPos);

    // Load UI
    player.ui.load('ui/index.html');

    // Send welcome messages
    this.world.chatManager.sendPlayerMessage(
      player,
      `Welcome to Dodgeball! You are on ${team === Team.RED ? 'RED' : 'BLUE'} team`,
      team === Team.RED ? 'FF0000' : '0000FF'
    );

    // Update UI with game state
    this._updatePlayerUI(player);
    
    // Check if we can start a game
    this._checkForGameStart();
  }

  public handlePlayerLeave(player: Player): void {
    if (!this.world) return;

    // Clean up player entities
    this.world.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach(entity => entity.despawn());

    // Remove from teams and alive players
    this._playerTeams.delete(player.id);
    this._alivePlayers.delete(player.id);

    // Check if game should end
    if (this._gameState === GameState.PLAYING) {
      this._checkForRoundEnd();
    }
  }

  public eliminatePlayer(player: Player): void {
    this._alivePlayers.set(player.id, false);
    
    if (!this.world) return;
    
    this.world.chatManager.sendBroadcastMessage(
      `${player.username} has been eliminated!`,
      'FFFF00'
    );

    // Update UI
    this._updatePlayerUI(player);
    
    // Check for round end
    this._checkForRoundEnd();
  }

  private _assignTeam(): Team {
    const redCount = Array.from(this._playerTeams.values())
      .filter(team => team === Team.RED).length;
    const blueCount = Array.from(this._playerTeams.values())
      .filter(team => team === Team.BLUE).length;
    
    return redCount <= blueCount ? Team.RED : Team.BLUE;
  }

  private _getTeamSpawnPosition(team: Team): { x: number, y: number, z: number } {
    // Red team spawns on negative Z side, Blue on positive Z side
    if (team === Team.RED) {
      return {
        x: Math.random() * 20 - 10, // Random X within team area
        y: 2,
        z: -20,
      };
    } else {
      return {
        x: Math.random() * 20 - 10,
        y: 2,
        z: 20,
      };
    }
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
    import('./DodgeballEntity').then(({ default: DodgeballEntity }) => {
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

  private _updateAllPlayersUI(): void {
    if (!this.world) return;

    const players = GameServer.instance.playerManager
      .getConnectedPlayersByWorld(this.world);
    
    players.forEach(player => this._updatePlayerUI(player));
  }

  private _getTeamAliveCount(team: Team): number {
    return Array.from(this._playerTeams.entries())
      .filter(([playerId, t]) => 
        t === team && (this._alivePlayers.get(playerId) ?? false)
      ).length;
  }
}