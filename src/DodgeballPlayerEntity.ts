import {
  Player,
  DefaultPlayerEntity,
  DefaultPlayerEntityController,
  BaseEntityControllerEvent,
  World,
  PlayerCameraMode,
  Audio,
} from 'hytopia';

import GameManager from './GameManager.ts';
import { GameConfig, PowerUpType, POWER_UP_CONFIG, Team } from './GameConfig.ts';
import AchievementSystem from './AchievementSystem.ts';

interface ActivePowerUp {
  type: PowerUpType;
  endTime: number;
  effect: any;
}

export default class DodgeballPlayerEntity extends DefaultPlayerEntity {
  // Core player state
  private _isAlive: boolean = true;
  private _team: Team | null = null;
  private _health: number = GameConfig.PLAYER_HEALTH;
  private _shield: number = GameConfig.PLAYER_SHIELD;

  // Power-up system
  private _activePowerUps: Map<PowerUpType, ActivePowerUp> = new Map();
  private _powerUpEffects: Map<string, NodeJS.Timeout> = new Map();

  // Enhanced movement
  private _speedMultiplier: number = 1.0;
  private _dashCooldown: number = 0;

  // Statistics tracking
  private _stats = {
    eliminations: 0,
    deaths: 0,
    catches: 0,
    powerUpsCollected: 0,
    dashUses: 0,
  };

  // Audio effects
  private _hitAudio: Audio | undefined;
  private _powerUpAudio: Audio | undefined;

  public constructor(player: Player) {
    super({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelScale: 0.5,
    });

    this.initializePlayer();
  }

  private initializePlayer(): void {
    // Initialize statistics tracking
    AchievementSystem.instance.initializePlayer(this.player);

    // Set up audio effects
    this._hitAudio = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/player-hit.mp3',
      volume: 0.7,
    });

    this._powerUpAudio = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/power-up-collect.mp3',
      volume: 0.8,
    });

    console.log(`🎮 Enhanced player initialized for ${this.player.username}`);
  }

  public override spawn(world: World, position: any, rotation?: any): void {
    super.spawn(world, position, rotation);

    // Reset player state
    this._isAlive = true;
    this._health = GameConfig.PLAYER_HEALTH;
    this._shield = GameConfig.PLAYER_SHIELD;
    this._speedMultiplier = 1.0;
    this._dashCooldown = 0;

    // Clear any active power-ups
    this.clearAllPowerUps();

    // Set up enhanced player systems
    setTimeout(() => {
      this.setupEnhancedController();
      this.setupEnhancedCamera();
    }, 100);

    // Send enhanced welcome message
    if (this.world) {
      this.world.chatManager.sendPlayerMessage(
        this.player,
        '🎯 Welcome to Ultimate Dodgeball Arena!',
        '00FF00'
      );

      this.world.chatManager.sendPlayerMessage(
        this.player,
        'Controls: WASD (Move), Space (Jump), Shift (Run), Left Click (Throw), Right Click (Catch), Q (Dash)',
        'FFFF00'
      );
    }
  }

  public get isAlive(): boolean {
    return this._isAlive;
  }

  // Enhanced elimination with shield system
  public eliminate(): void {
    if (!this._isAlive) return;

    // Check shield first
    if (this._shield > 0) {
      this._shield = 0;
      this._activePowerUps.delete(PowerUpType.SHIELD);

      // Shield break effect
      this.world?.createParticleEffect(this.position, 'shield_break');
      this.world?.chatManager.sendPlayerMessage(
        this.player,
        '🛡️ Shield broke! You survived!',
        '00CED1'
      );
      return;
    }

    this._isAlive = false;
    this._stats.deaths++;

    // Record death for achievements
    AchievementSystem.instance.recordDeath(this.player);

    // Visual effects
    this.setOpacity(0.5);
    this.startModelOneshotAnimations(['death']);

    // Disable movement
    this.playerController.canWalk = () => false;
    this.playerController.canRun = () => false;
    this.playerController.canJump = () => false;

    // Notify game manager
    GameManager.instance.eliminatePlayer(this.player);
  }

  public takeDamage(damage: number): void {
    this._health -= damage;

    // Visual feedback
    this.setTintColor({ r: 255, g: 0, b: 0 });
    setTimeout(() => this.setTintColor({ r: 255, g: 255, b: 255 }), 200);

    // Audio feedback
    this._hitAudio?.play(this.world);

    // Check for elimination
    if (this._health <= 0) {
      this.eliminate();
    }
  }

  public respawn(): void {
    this._isAlive = true;
    this._health = GameConfig.PLAYER_HEALTH;
    this._shield = GameConfig.PLAYER_SHIELD;

    // Restore visual
    this.setOpacity(1.0);
    this.clearAllPowerUps();

    // Restore movement
    this.playerController.canWalk = () => true;
    this.playerController.canRun = () => true;
    this.playerController.canJump = () => true;

    // Reset animations
    this.setupAnimations();

    // Respawn audio
    new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/respawn.mp3',
      volume: 0.6,
    }).play(this.world);
  }

  // Update method called every frame
  public update(deltaTimeMs: number): void {
    // Update power-up effects
    this.updatePowerUps(deltaTimeMs);

    // Update cooldowns
    if (this._dashCooldown > 0) {
      this._dashCooldown -= deltaTimeMs;
    }
  }

  private updatePowerUps(deltaTimeMs: number): void {
    const now = Date.now();
    const toRemove: PowerUpType[] = [];

    for (const [type, powerUp] of this._activePowerUps) {
      if (powerUp.endTime > 0 && now >= powerUp.endTime) {
        toRemove.push(type);
      }
    }

    // Remove expired power-ups
    for (const type of toRemove) {
      this._activePowerUps.delete(type);

      // Handle cleanup for specific power-ups
      switch (type) {
        case PowerUpType.INVISIBILITY:
          this.setOpacity(1.0);
          break;
        case PowerUpType.SPEED_BOOST:
          this.clearGlowEffect();
          break;
          }
  }

  // Getters
  public get team(): Team | null {
    return this._team;
  }

  public set team(team: Team | null) {
    this._team = team;
  }

  public get health(): number {
    return this._health;
  }

  public get shield(): number {
    return this._shield;
  }

  public get stats() {
    return { ...this._stats };
  }

  public get activePowerUps(): PowerUpType[] {
    return Array.from(this._activePowerUps.keys());
  }

  // Mobile control methods
  public handleThrow(): void {
    // Trigger throw action - would need to implement throwing logic
    console.log(`🎯 ${this.player?.username} triggered throw from mobile`);
    // This would typically trigger the throw animation and create a dodgeball
  }

  public handleCatch(): void {
    // Trigger catch action - would need to implement catching logic
    console.log(`👐 ${this.player?.username} triggered catch from mobile`);
    // This would typically check for nearby catchable dodgeballs
  }

  public handleDash(): void {
    // Trigger dash action
    console.log(`⚡ ${this.player?.username} triggered dash from mobile`);
    // This would typically trigger the dash movement
  }
}