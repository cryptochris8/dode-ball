import {
  Audio,
  Collider,
  CollisionGroup,
  Entity,
  EntityEvent,
  RigidBodyType,
  World,
  Vector3,
} from 'hytopia';

import DodgeballPlayerEntity from './DodgeballPlayerEntity.ts';
import { GameConfig, PowerUpType } from './GameConfig.ts';

export default class DodgeballEntity extends Entity {
  private _thrower: DodgeballPlayerEntity | undefined;
  private _bounceCount: number = 0;
  private _canCatch: boolean = true;
  private _catchWindow: NodeJS.Timeout | undefined;
  private _lifetime: number = 0;
  private _maxLifetime: number = GameConfig.DODGEBALL_LIFETIME_MS;
  private _isPowered: boolean = false;
  private _powerLevel: number = 1;
  private _trailParticles: any[] = [];
  private _magnetTargets: DodgeballPlayerEntity[] = [];
  private _lastPosition: Vector3 = new Vector3();
  private _spinSpeed: number = 0;
  private _damageMultiplier: number = 1;

  public constructor(powerLevel: number = 1) {
    super({
      name: 'Dodgeball',
      modelUri: 'models/items/snowball.gltf',
      modelScale: 1.2 * powerLevel, // Scale with power level
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        additionalMass: 2 * powerLevel, // Heavier with more power
        enabledRotations: { x: true, y: true, z: true },
        colliders: [
          {
            shape: 'ball',
            radius: 0.3 * powerLevel, // Larger hitbox for powered balls
            bounciness: 0.7 + (powerLevel * 0.1), // More bouncy with power
            friction: 0.3,
            collisionGroups: {
              belongsTo: [CollisionGroup.ENTITY],
              collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY],
            },
          },
        ],
      },
    });

    this._powerLevel = powerLevel;
    this._isPowered = powerLevel > 1;
    this._damageMultiplier = powerLevel;
    this._maxLifetime = GameConfig.DODGEBALL_LIFETIME_MS * (1 + powerLevel * 0.5); // Longer lifetime for powered balls

    // Set visual properties based on power level
    this.setGlowEffect(powerLevel);
  }

  private setGlowEffect(powerLevel: number): void {
    if (powerLevel > 1) {
      // Add glow effect for powered balls
      const glowColor = powerLevel > 2 ? '#FFD700' : '#FF6B35'; // Gold for high power, orange for medium
      console.log(`✨ Dodgeball glow effect: ${glowColor} at power level ${powerLevel}`);
      // Implementation would apply actual glow effect
    }
  }

  public override spawn(world: World, position: any, rotation?: any): void {
    super.spawn(world, position, rotation);

    // Store initial position for trail effects
    this._lastPosition = new Vector3(position.x, position.y, position.z);
    this._lifetime = 0;

    // Set up collision handling
    this.on(EntityEvent.ENTITY_COLLISION, this._onEntityCollision);
    this.on(EntityEvent.BLOCK_COLLISION, this._onBlockCollision);

    // Set up tick handler for trail effects and lifetime management
    this.on(EntityEvent.TICK, this._onTick.bind(this));

    // Auto-despawn timer
    setTimeout(() => {
      if (this.isSpawned) {
        this.despawn();
      }
    }, this._maxLifetime);

    console.log(`🏐 Spawned dodgeball (power: ${this._powerLevel}) at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  private _onTick(deltaTimeMs: number): void {
    if (!this.world) return;

    // Update lifetime
    this._lifetime += deltaTimeMs;

    // Create trail effect for powered balls
    if (this._isPowered && this._lifetime % 100 < 16) { // Every ~100ms
      this.createTrailParticle();
    }

    // Handle magnet effect
    this.updateMagnetEffect(deltaTimeMs);

    // Update spin effect
    this.updateSpinEffect(deltaTimeMs);

    // Check lifetime expiration
    if (this._lifetime >= this._maxLifetime) {
      this.despawn();
    }
  }

  private createTrailParticle(): void {
    if (!this.world) return;

    // Create a trail particle at the current position
    const trailPosition = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };

    // Add to trail particles array (limited size)
    this._trailParticles.push({
      position: trailPosition,
      lifetime: 0,
      maxLifetime: 1000, // 1 second
    });

    // Remove old trail particles
    this._trailParticles = this._trailParticles.filter(particle => {
      particle.lifetime += 16; // ~60fps
      return particle.lifetime < particle.maxLifetime;
    });

    // Visual trail effect
    console.log(`✨ Trail particle created at dodgeball position`);
    // Implementation would create actual particle effect
  }

  private updateMagnetEffect(deltaTimeMs: number): void {
    // Handle magnet effect from power-ups
    this._magnetTargets.forEach(target => {
      if (!target.isAlive || !this.world) return;

      const distance = Math.sqrt(
        Math.pow(target.position.x - this.position.x, 2) +
        Math.pow(target.position.z - this.position.z, 2)
      );

      if (distance < 20) { // Magnet range
        // Calculate attraction force
        const direction = {
          x: target.position.x - this.position.x,
          y: 0,
          z: target.position.z - this.position.z,
        };

        // Normalize
        const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        if (length > 0) {
          direction.x /= length;
          direction.z /= length;
        }

        // Apply magnet force
        const magnetStrength = 2; // Configurable
        this.applyForce({
          x: direction.x * magnetStrength,
          y: 0,
          z: direction.z * magnetStrength,
        });
      }
    });
  }

  private updateSpinEffect(deltaTimeMs: number): void {
    if (this._spinSpeed > 0) {
      // Apply spin rotation
      const spinAmount = this._spinSpeed * (deltaTimeMs / 1000);
      this.setAngularVelocity({
        x: 0,
        y: spinAmount,
        z: 0,
      });
    }
  }

  public throw(thrower: DodgeballPlayerEntity, direction: Vector3Like, force: number = GameConfig.DODGEBALL_SPEED): void {
    if (!this.world) return;

    this._thrower = thrower;
    this._bounceCount = 0;
    this._canCatch = true;
    this._lifetime = 0;

    // Calculate enhanced throw force based on power level
    const enhancedForce = force * this._powerLevel;
    const throwDirection = this.calculateThrowDirection(direction);

    // Apply throwing force with enhanced physics
    this.applyImpulse({
      x: throwDirection.x * enhancedForce * this.mass,
      y: throwDirection.y * enhancedForce * this.mass + (this._powerLevel > 1 ? 2 : 0), // Extra upward force for powered throws
      z: throwDirection.z * enhancedForce * this.mass,
    });

    // Add spin for visual effect
    this._spinSpeed = 10 * this._powerLevel;
    this.setAngularVelocity({
      x: 0,
      y: this._spinSpeed,
      z: 0,
    });

    // Start catch window timer
    this._startCatchWindow();

    // Play enhanced throw sound based on power level
    const throwAudio = new Audio({
      attachedToEntity: this,
      uri: this._powerLevel > 2 ? 'audio/sfx/power_throw.mp3' : 'audio/sfx/throw.mp3',
      volume: 0.5 + (this._powerLevel * 0.1),
      referenceDistance: 8,
      cutoffDistance: 20,
    });
    throwAudio.play(this.world, true);

    // Visual throw effect
    if (this._powerLevel > 1) {
      this.createThrowEffect();
    }

    console.log(`🏐 ${thrower.player.username} threw dodgeball (power: ${this._powerLevel}, force: ${enhancedForce.toFixed(1)})`);
  }

  private calculateThrowDirection(baseDirection: Vector3Like): Vector3Like {
    // Add slight randomness for more realistic throws
    const spread = 0.05; // 5% spread
    return {
      x: baseDirection.x + (Math.random() - 0.5) * spread,
      y: baseDirection.y + (Math.random() - 0.5) * spread,
      z: baseDirection.z + (Math.random() - 0.5) * spread,
    };
  }

  private createThrowEffect(): void {
    if (!this.world) return;

    // Create throw effect particles
    console.log(`💥 Throw effect created for powered dodgeball`);
    // Implementation would create actual particle effect
  }

  // Magnet system methods
  public addMagnetTarget(target: DodgeballPlayerEntity): void {
    if (!this._magnetTargets.includes(target)) {
      this._magnetTargets.push(target);
    }
  }

  public removeMagnetTarget(target: DodgeballPlayerEntity): void {
    this._magnetTargets = this._magnetTargets.filter(t => t !== target);
  }

  public clearMagnetTargets(): void {
    this._magnetTargets = [];
  }

  public canBeCaught(): boolean {
    return this._canCatch && this._bounceCount === 0;
  }

  public catch(catcher: DodgeballPlayerEntity): void {
    if (!this.canBeCaught() || !this.world) return;

    // Play catch sound
    const catchAudio = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/catch.mp3',
      volume: 0.6,
      referenceDistance: 8,
      cutoffDistance: 20,
    });
    catchAudio.play(this.world, true);

    // If the thrower is eliminated by a catch, handle that
    if (this._thrower && this._thrower !== catcher && this._thrower.isAlive) {
      this._thrower.eliminate();
      
      if (this.world) {
        this.world.chatManager.sendBroadcastMessage(
          `${catcher.player.username} caught ${this._thrower.player.username}'s throw!`,
          '00FF00'
        );
      }
    }

    // Remove the ball
    this.despawn();
  }

  private _onEntityCollision = (event: any): void => {
    const { hitEntity } = event;

    if (!(hitEntity instanceof DodgeballPlayerEntity)) return;

    const player = hitEntity as DodgeballPlayerEntity;

    // Don't hit the thrower immediately after throwing
    if (player === this._thrower && this._bounceCount === 0) return;

    // Don't hit dead players
    if (!player.isAlive) return;

    // Handle the hit with enhanced damage calculation
    this._handlePlayerHit(player);
  };

  private _onBlockCollision = (): void => {
    this._bounceCount++;

    // Create bounce effect
    this.createBounceEffect();

    // After bouncing, the ball can no longer be caught for elimination
    if (this._bounceCount >= GameConfig.DODGEBALL_MAX_BOUNCES) {
      this._canCatch = false;
      if (this._catchWindow) {
        clearTimeout(this._catchWindow);
        this._catchWindow = undefined;
      }
    }

    // Reduce damage after each bounce
    this._damageMultiplier *= GameConfig.ADVANCED.BOUNCE_DAMAGE_MULTIPLIER;

    // Play enhanced bounce sound based on power level
    if (this.world) {
      const bounceAudio = new Audio({
        attachedToEntity: this,
        uri: this._powerLevel > 2 ? 'audio/sfx/power_bounce.mp3' : 'audio/sfx/bounce.mp3',
        volume: 0.4 + (this._powerLevel * 0.1),
        referenceDistance: 6,
        cutoffDistance: 15,
      });
      bounceAudio.play(this.world, true);
    }

    console.log(`🏐 Dodgeball bounced ${this._bounceCount} times (damage multiplier: ${this._damageMultiplier.toFixed(2)})`);
  };

  private createBounceEffect(): void {
    if (!this.world) return;

    // Create bounce particle effect
    console.log(`💥 Bounce effect created`);
    // Implementation would create actual particle effect at bounce location
  }

  private _handlePlayerHit(player: DodgeballPlayerEntity): void {
    if (!this.world || !this._thrower) return;

    // Calculate damage based on various factors
    const baseDamage = GameConfig.DODGEBALL_DAMAGE;
    const finalDamage = Math.floor(baseDamage * this._damageMultiplier * this._powerLevel);

    // Create hit effect
    this.createHitEffect(player);

    // If the ball has bounced too many times, it doesn't eliminate players
    if (this._bounceCount >= GameConfig.DODGEBALL_MAX_BOUNCES) {
      // Just play a hit sound and apply minimal damage
      this.playHitSound('soft');
      this.applyHitKnockback(player);
      this.despawn();
      return;
    }

    // Check if it's a direct hit (no bounces)
    if (this._bounceCount === 0) {
      // Direct hit - attempt to eliminate
      if (this.attemptElimination(player, finalDamage)) {
        this.playHitSound('elimination');
        this.createEliminationEffect(player);

        // Record elimination for achievements
        if (this._thrower) {
          // AchievementSystem.instance.recordElimination(this._thrower.player, player.player.id);
        }
      } else {
        // Player survived the hit
        this.playHitSound('deflected');
      }
    } else {
      // Bounced hit - apply damage but don't eliminate
      this.applyDamage(player, finalDamage);
      this.playHitSound('bounced');
    }

    // Remove the ball after hit
    this.despawn();
  }

  private attemptElimination(player: DodgeballPlayerEntity, damage: number): boolean {
    if (!this.world || !this._thrower) return false;

    // Check if player has shield protection
    if (player.shield > 0) {
      // Shield absorbs the elimination
      console.log(`🛡️ ${player.player.username}'s shield absorbed the elimination!`);
      return false;
    }

    // Attempt elimination
    player.eliminate();

    // Send elimination message
    const teamEmoji = player.team === 'red' ? '🔴' : '🔵';
    const powerText = this._powerLevel > 1 ? ` (Power ${this._powerLevel})` : '';

    this.world.chatManager.sendBroadcastMessage(
      `${this._thrower.player.username} eliminated ${teamEmoji} ${player.player.username} with a dodgeball${powerText}!`,
      this._powerLevel > 2 ? 'FFD700' : 'FF4444'
    );

    return true;
  }

  private applyDamage(player: DodgeballPlayerEntity, damage: number): void {
    player.takeDamage(damage);

    if (this.world) {
      this.world.chatManager.sendPlayerMessage(
        player.player,
        `💥 You took ${damage} damage from a dodgeball!`,
        'FFA500'
      );
    }
  }

  private applyHitKnockback(player: DodgeballPlayerEntity): void {
    // Apply knockback effect based on dodgeball velocity
    const knockbackForce = 5 * this._powerLevel;
    const direction = {
      x: player.position.x - this.position.x,
      y: 0,
      z: player.position.z - this.position.z,
    };

    // Normalize direction
    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (length > 0) {
      direction.x /= length;
      direction.z /= length;
    }

    // Apply knockback impulse
    player.applyImpulse({
      x: direction.x * knockbackForce,
      y: 2, // Slight upward force
      z: direction.z * knockbackForce,
    });
  }

  private playHitSound(type: 'soft' | 'bounced' | 'elimination' | 'deflected'): void {
    if (!this.world) return;

    let soundUri: string;
    let volume: number;

    switch (type) {
      case 'elimination':
        soundUri = 'audio/sfx/elimination.mp3';
        volume = 0.8;
        break;
      case 'deflected':
        soundUri = 'audio/sfx/deflect.mp3';
        volume = 0.6;
        break;
      case 'bounced':
        soundUri = 'audio/sfx/bounced_hit.mp3';
        volume = 0.5;
        break;
      default:
        soundUri = 'audio/sfx/ball_hit.mp3';
        volume = 0.4;
    }

    const hitAudio = new Audio({
      attachedToEntity: this,
      uri: soundUri,
      volume: volume + (this._powerLevel * 0.1),
      referenceDistance: 8,
      cutoffDistance: 20,
    });
    hitAudio.play(this.world, true);
  }

  private createHitEffect(player: DodgeballPlayerEntity): void {
    if (!this.world) return;

    // Create hit particle effect at collision point
    const hitPosition = {
      x: (this.position.x + player.position.x) / 2,
      y: (this.position.y + player.position.y) / 2,
      z: (this.position.z + player.position.z) / 2,
    };

    console.log(`💥 Hit effect created at (${hitPosition.x.toFixed(1)}, ${hitPosition.z.toFixed(1)})`);
    // Implementation would create actual particle effect
  }

  private createEliminationEffect(player: DodgeballPlayerEntity): void {
    if (!this.world) return;

    // Create elimination particle effect
    console.log(`💀 Elimination effect created for ${player.player.username}`);
    // Implementation would create dramatic elimination effect
  }

  private _startCatchWindow(): void {
    // Clear any existing catch window timer
    if (this._catchWindow) {
      clearTimeout(this._catchWindow);
    }

    // After the catch window expires, the ball can no longer be caught
    this._catchWindow = setTimeout(() => {
      this._canCatch = false;
      this._catchWindow = undefined;
    }, GameConfig.DODGEBALL_CATCH_WINDOW_MS);
  }

  public override despawn(): void {
    // Clean up timers
    if (this._catchWindow) {
      clearTimeout(this._catchWindow);
      this._catchWindow = undefined;
    }

    // Clear magnet targets
    this.clearMagnetTargets();

    // Clear trail particles
    this._trailParticles = [];

    // Reset spin
    this._spinSpeed = 0;
    this.setAngularVelocity({ x: 0, y: 0, z: 0 });

    console.log(`🏐 Dodgeball despawned (power: ${this._powerLevel}, bounces: ${this._bounceCount}, lifetime: ${this._lifetime}ms)`);

    super.despawn();
  }

  // Getter methods
  public get powerLevel(): number {
    return this._powerLevel;
  }

  public get bounceCount(): number {
    return this._bounceCount;
  }

  public get lifetime(): number {
    return this._lifetime;
  }

  public get thrower(): DodgeballPlayerEntity | undefined {
    return this._thrower;
  }

  public get isPowered(): boolean {
    return this._isPowered;
  }

  public get damageMultiplier(): number {
    return this._damageMultiplier;
  }

  // Static factory method for creating powered dodgeballs
  public static createPowered(powerLevel: number = 1): DodgeballEntity {
    return new DodgeballEntity(powerLevel);
  }
}