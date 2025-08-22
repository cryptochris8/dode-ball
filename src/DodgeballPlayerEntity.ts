import {
  Player,
  DefaultPlayerEntity,
  DefaultPlayerEntityController,
  BaseEntityControllerEvent,
  EventPayloads,
  World,
  Vector3Like,
  QuaternionLike,
  PlayerCameraMode,
} from 'hytopia';

import GameManager, { Team } from './GameManager';

export default class DodgeballPlayerEntity extends DefaultPlayerEntity {
  private _isAlive: boolean = true;

  public constructor(player: Player) {
    super({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelScale: 0.5,
    });
  }

  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    
    // Set up our custom behavior after spawn
    setTimeout(() => {
      this._setupPlayerController();
      this._setupPlayerCamera();
    }, 100); // Small delay to ensure controller is ready
    
    // Send welcome message
    if (this.world) {
      this.world.chatManager.sendPlayerMessage(
        this.player,
        'Welcome to Dodgeball! Use WASD to move, Space to jump, Shift to run.',
        '00FF00'
      );
      this.world.chatManager.sendPlayerMessage(
        this.player,
        'Left click to throw dodgeballs!',
        '00FF00'
      );
    }
  }

  public get isAlive(): boolean {
    return this._isAlive;
  }

  public eliminate(): void {
    if (!this._isAlive) return;
    
    this._isAlive = false;
    
    // Visual effect - make player semi-transparent
    this.setOpacity(0.5);
    
    // Prevent movement
    this.playerController.canWalk = () => false;
    this.playerController.canRun = () => false;
    this.playerController.canJump = () => false;
    
    // Play elimination animation
    this.startModelOneshotAnimations(['sleep']);
    
    // Notify game manager
    GameManager.instance.eliminatePlayer(this.player);
  }

  public revive(): void {
    this._isAlive = true;
    
    // Restore visual
    this.setOpacity(1.0);
    
    // Restore movement
    this.playerController.canWalk = () => true;
    this.playerController.canRun = () => true;
    this.playerController.canJump = () => true;
    
    // Reset animations
    this.resetAnimations();
  }

  private _setupPlayerController(): void {
    if (!this.playerController) {
      console.warn('Player controller not ready, retrying...');
      setTimeout(() => this._setupPlayerController(), 100);
      return;
    }

    // Allow continuous left click for throwing
    this.playerController.autoCancelMouseLeftClick = false;
    
    // Set up input handling
    this.playerController.on(
      BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT,
      this._onTickWithPlayerInput
    );
    
    // Reset animations to defaults
    this.resetAnimations();
  }

  private _setupPlayerCamera(): void {
    // Use first-person view for better dodgeball throwing
    this.player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    this.player.camera.setModelHiddenNodes(['head', 'neck']);
    this.player.camera.setOffset({ x: 0, y: 0.5, z: 0 });
  }

  private _onTickWithPlayerInput = (payload: EventPayloads[BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT]): void => {
    const { input } = payload;

    // Only handle input if player is alive
    if (!this._isAlive) {
      // Clear all inputs for dead players
      Object.keys(input).forEach(key => {
        input[key] = false;
      });
      return;
    }

    // Handle throwing
    if (input.ml) {
      this._handleThrow();
      input.ml = false; // Prevent spam clicking
    }

    // Handle catching
    if (input.mr) {
      this._handleCatch();
      input.mr = false; // Prevent spam clicking
    }
  };

  private _handleThrow(): void {
    if (!this.world || !this._isAlive) return;
    
    console.log(`${this.player.username} is throwing a dodgeball!`);
    
    // Play throwing animation
    this.startModelOneshotAnimations(['simple_interact']);
    
    // Create and throw a dodgeball
    this._createAndThrowDodgeball();
  }

  private _createAndThrowDodgeball(): void {
    if (!this.world) return;

    // Import DodgeballEntity dynamically to avoid circular imports
    import('./DodgeballEntity').then(({ default: DodgeballEntity }) => {
      if (!this.world) return;

      const dodgeball = new DodgeballEntity();
      
      // Calculate spawn position in front of player
      const spawnPosition = {
        x: this.position.x + this.player.camera.facingDirection.x * 1.5,
        y: this.position.y + this.player.camera.offset.y,
        z: this.position.z + this.player.camera.facingDirection.z * 1.5,
      };
      
      // Spawn the dodgeball
      dodgeball.spawn(this.world, spawnPosition);
      
      // Throw it in the facing direction
      dodgeball.throw(this, this.player.camera.facingDirection);
    });
  }

  private _handleCatch(): void {
    if (!this.world || !this._isAlive) return;

    // Look for catchable dodgeballs in range
    const catchRange = 2.0;
    const playerPos = this.position;

    // Import DodgeballEntity to check for catchable balls
    import('./DodgeballEntity').then(({ default: DodgeballEntity }) => {
      if (!this.world) return;

      const dodgeballs = this.world.entityManager.getAllEntities()
        .filter(entity => entity instanceof DodgeballEntity) as DodgeballEntity[];

      for (const dodgeball of dodgeballs) {
        const distance = Math.sqrt(
          Math.pow(dodgeball.position.x - playerPos.x, 2) +
          Math.pow(dodgeball.position.y - playerPos.y, 2) +
          Math.pow(dodgeball.position.z - playerPos.z, 2)
        );

        if (distance <= catchRange && dodgeball.canBeCaught()) {
          dodgeball.catch(this);
          
          // Play catch animation
          this.startModelOneshotAnimations(['simple_interact']);
          
          if (this.world) {
            this.world.chatManager.sendPlayerMessage(
              this.player,
              'Nice catch!',
              '00FF00'
            );
          }
          return;
        }
      }

      // No catchable ball found
      if (this.world) {
        this.world.chatManager.sendPlayerMessage(
          this.player,
          'No ball in range to catch!',
          'FFFF00'
        );
      }
    });
  }

  private resetAnimations(): void {
    this.playerController.idleLoopedAnimations = ['idle_lower', 'idle_upper'];
    this.playerController.walkLoopedAnimations = ['walk_lower', 'walk_upper'];
    this.playerController.runLoopedAnimations = ['run_lower', 'run_upper'];
    this.playerController.jumpOneshotAnimations = ['jump'];
  }
}