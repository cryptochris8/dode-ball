import {
  Audio,
  Collider,
  CollisionGroup,
  Entity,
  EntityEvent,
  RigidBodyType,
  Vector3Like,
  QuaternionLike,
  World,
  Vector3,
} from 'hytopia';

import DodgeballPlayerEntity from './DodgeballPlayerEntity';
import { GameConfig } from './GameConfig';

export default class DodgeballEntity extends Entity {
  private _thrower: DodgeballPlayerEntity | undefined;
  private _bounceCount: number = 0;
  private _canCatch: boolean = true;
  private _catchWindow: NodeJS.Timeout | undefined;

  public constructor() {
    super({
      name: 'Dodgeball',
      modelUri: 'models/items/snowball.gltf',
      modelScale: 1.2,
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        additionalMass: 2,
        enabledRotations: { x: true, y: true, z: true },
        colliders: [
          {
            shape: 'ball',
            radius: 0.3,
            bounciness: 0.7,
            friction: 0.3,
            collisionGroups: {
              belongsTo: [CollisionGroup.ENTITY],
              collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY],
            },
          },
        ],
      },
    });
  }

  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    
    // Set up collision handling
    this.on(EntityEvent.ENTITY_COLLISION, this._onEntityCollision);
    this.on(EntityEvent.BLOCK_COLLISION, this._onBlockCollision);
    
    // Despawn after 15 seconds if still in world
    setTimeout(() => {
      if (this.isSpawned) {
        this.despawn();
      }
    }, 15000);
  }

  public throw(thrower: DodgeballPlayerEntity, direction: Vector3Like, force: number = GameConfig.DODGEBALL_SPEED): void {
    if (!this.world) return;

    this._thrower = thrower;
    this._bounceCount = 0;
    this._canCatch = true;

    // Apply throwing force
    this.applyImpulse({
      x: direction.x * force * this.mass,
      y: direction.y * force * this.mass,
      z: direction.z * force * this.mass,
    });

    // Start catch window timer
    this._startCatchWindow();

    // Play throw sound
    const throwAudio = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/throw.mp3',
      volume: 0.5,
      referenceDistance: 8,
      cutoffDistance: 20,
    });
    throwAudio.play(this.world, true);
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

    // Handle the hit
    this._handlePlayerHit(player);
  };

  private _onBlockCollision = (): void => {
    this._bounceCount++;
    
    // After bouncing, the ball can no longer be caught for elimination
    if (this._bounceCount > 0) {
      this._canCatch = false;
      if (this._catchWindow) {
        clearTimeout(this._catchWindow);
        this._catchWindow = undefined;
      }
    }

    // Play bounce sound
    if (this.world) {
      const bounceAudio = new Audio({
        attachedToEntity: this,
        uri: 'audio/sfx/bounce.mp3',
        volume: 0.4,
        referenceDistance: 6,
        cutoffDistance: 15,
      });
      bounceAudio.play(this.world, true);
    }
  };

  private _handlePlayerHit(player: DodgeballPlayerEntity): void {
    if (!this.world || !this._thrower) return;

    // If the ball has bounced, it doesn't eliminate players
    if (this._bounceCount > 0) {
      // Just play a hit sound and despawn
      const hitAudio = new Audio({
        attachedToEntity: this,
        uri: 'audio/sfx/ball_hit.mp3',
        volume: 0.5,
        referenceDistance: 8,
        cutoffDistance: 20,
      });
      hitAudio.play(this.world, true);
      this.despawn();
      return;
    }

    // Direct hit eliminates the player
    player.eliminate();
    
    this.world.chatManager.sendBroadcastMessage(
      `${this._thrower.player.username} eliminated ${player.player.username} with a dodgeball!`,
      'FF4444'
    );

    // Play elimination sound
    const eliminationAudio = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/elimination.mp3',
      volume: 0.7,
      referenceDistance: 10,
      cutoffDistance: 25,
    });
    eliminationAudio.play(this.world, true);

    // Remove the ball
    this.despawn();
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
    
    super.despawn();
  }
}