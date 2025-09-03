/**
 * ⚡ Power-up Entity
 *
 * Manages power-up spawning, collection, and effects in the dodgeball arena.
 */

import {
  Entity,
  EntityEvent,
  World,
  Audio,
} from 'hytopia';

import {
  PowerUpType,
  POWER_UP_CONFIG,
  GameConfig,
} from './GameConfig.ts';
import DodgeballPlayerEntity from './DodgeballPlayerEntity.ts';

export default class PowerUpEntity extends Entity {
  private _powerUpType: PowerUpType;
  private _collected: boolean = false;
  private _spawnTime: number;
  private _despawnTimer: NodeJS.Timeout | undefined;
  private _glowEffect: any;

  constructor(powerUpType: PowerUpType) {
    const config = POWER_UP_CONFIG[powerUpType];

    super({
      name: config.name,
      modelUri: 'models/items/power-up-sphere.gltf', // You'll need to create this model
      modelScale: 0.8,
      rigidBodyOptions: {
        type: 'kinematic_position',
        colliders: [
          {
            shape: 'sphere',
            radius: 0.5,
            isSensor: true,
          },
        ],
      },
    });

    this._powerUpType = powerUpType;
    this._spawnTime = Date.now();

    // Set up visual glow effect
    this._glowEffect = {
      color: config.color,
      intensity: GameConfig.EFFECTS.POWER_UP_GLOW_INTENSITY,
    };

    // Auto-despawn after 30 seconds
    this._despawnTimer = setTimeout(() => {
      if (this.isSpawned) {
        this.despawn();
      }
    }, 30000);
  }

  public override spawn(world: World, position: any, rotation?: any): void {
    super.spawn(world, position, rotation);

    // Set up floating animation
    this.startFloatingAnimation();

    // Set up collision detection
    this.on(EntityEvent.ENTITY_COLLISION, ({ otherEntity, started }) => {
      if (started && otherEntity instanceof DodgeballPlayerEntity && !this._collected) {
        this.collect(otherEntity);
      }
    });

    // Play spawn sound
    new Audio({
      uri: 'audio/sfx/power-up-spawn.mp3',
      volume: 0.6,
      position: position,
    }).play(world);
  }

  private startFloatingAnimation(): void {
    if (!this.world) return;

    // Create floating and rotating motion
    let phase = 0;
    const floatHeight = 0.5;
    const floatSpeed = 0.002;
    const rotateSpeed = 0.01;

    const animate = () => {
      if (!this.isSpawned) return;

      phase += floatSpeed;
      const newY = this.position.y + Math.sin(phase) * floatHeight;
      const newRotation = phase * rotateSpeed;

      this.setPosition({
        x: this.position.x,
        y: newY,
        z: this.position.z,
      });

      this.setRotation({
        x: 0,
        y: newRotation,
        z: 0,
        w: Math.cos(newRotation / 2),
      });

      // Continue animation
      setTimeout(animate, 16); // ~60fps
    };

    animate();
  }

  private async collect(player: DodgeballPlayerEntity): Promise<void> {
    if (this._collected || !this.world) return;

    this._collected = true;
    const config = POWER_UP_CONFIG[this._powerUpType];

    // Visual feedback
    this.setOpacity(0);
    this.world.createParticleEffect(this.position, 'power-up-collect');

    // Audio feedback
    new Audio({
      uri: 'audio/sfx/power-up-collect.mp3',
      volume: 0.8,
      position: this.position,
    }).play(this.world);

    // Apply power-up effect
    await this.applyPowerUpEffect(player);

    // Send notification to player
    this.world.chatManager.sendPlayerMessage(
      player.player,
      `🎉 Collected ${config.name}! ${config.description}`,
      config.color.replace('#', '')
    );

    // Clean up
    clearTimeout(this._despawnTimer);
    this.despawn();
  }

  private async applyPowerUpEffect(player: DodgeballPlayerEntity): Promise<void> {
    const config = POWER_UP_CONFIG[this._powerUpType];
    const effect = config.effect;

    switch (this._powerUpType) {
      case PowerUpType.SPEED_BOOST:
        player.applySpeedBoost(effect.speedMultiplier, effect.duration);
        break;

      case PowerUpType.INVISIBILITY:
        player.applyInvisibility(effect.duration);
        break;

      case PowerUpType.MULTI_THROW:
        player.applyMultiThrow(effect.throwCount, effect.duration);
        break;

      case PowerUpType.SHIELD:
        player.applyShield(effect.shieldAmount);
        break;

      case PowerUpType.TELEPORT:
        player.teleportToSafeLocation();
        break;

      case PowerUpType.FREEZE:
        await player.applyFreezeRay(effect.range, effect.freezeDuration);
        break;

      case PowerUpType.MAGNET:
        player.applyMagnetEffect(effect.range, effect.strength, effect.duration);
        break;

      case PowerUpType.TIME_SLOW:
        this.world?.applyTimeSlowEffect(effect.timeScale, effect.duration);
        break;
    }
  }

  public override despawn(): void {
    clearTimeout(this._despawnTimer);
    super.despawn();
  }
}
