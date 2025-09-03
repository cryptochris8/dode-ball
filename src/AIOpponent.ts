/**
 * 🤖 AI Opponent System
 *
 * Intelligent computer-controlled opponents with different difficulty levels
 * and behavioral patterns for single-player and practice modes.
 */

import {
  Player,
  World,
  Vector3Like,
} from 'hytopia';

import DodgeballPlayerEntity from './DodgeballPlayerEntity.ts';
import GameManager from './GameManager.ts';
import { Team, GameConfig } from './GameConfig.ts';

export enum AIDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert',
  NIGHTMARE = 'nightmare',
}

export enum AIBehavior {
  AGGRESSIVE = 'aggressive',     // Focuses on eliminating opponents
  DEFENSIVE = 'defensive',       // Focuses on catching and surviving
  BALANCED = 'balanced',         // Mix of offensive and defensive play
  CHAOTIC = 'chaotic',           // Unpredictable, random actions
  TEAM_PLAYER = 'team_player',   // Coordinates with teammates
}

interface AIPlayer extends DodgeballPlayerEntity {
  aiDifficulty: AIDifficulty;
  aiBehavior: AIBehavior;
  targetPlayer?: DodgeballPlayerEntity;
  lastActionTime: number;
  decisionCooldown: number;
  movementTarget?: Vector3Like;
  throwCooldown: number;
  catchCooldown: number;
  personality: AIPersonality;
}

interface AIPersonality {
  aggression: number;        // 0-1, how likely to throw
  caution: number;          // 0-1, how careful with positioning
  reactionTime: number;     // milliseconds, how quickly they react
  accuracy: number;         // 0-1, how accurate their throws are
  movementSpeed: number;    // multiplier for movement
  catchSkill: number;       // 0-1, how good at catching
}

interface AIStrategy {
  priority: number;
  condition: (ai: AIPlayer, gameState: any) => boolean;
  action: (ai: AIPlayer, gameState: any) => void;
  cooldown: number;
}

export default class AIOpponent {
  private static _instance: AIOpponent;
  private _world: World | undefined;
  private _aiPlayers: Map<string, AIPlayer> = new Map();
  private _aiUpdateInterval: NodeJS.Timeout | undefined;
  private _strategies: AIStrategy[] = [];

  public static get instance(): AIOpponent {
    if (!this._instance) {
      this._instance = new AIOpponent();
    }
    return this._instance;
  }

  private constructor() {
    this.initializeStrategies();
  }

  public initialize(world: World): void {
    this._world = world;
    this.startAIUpdates();
    console.log('🤖 AI Opponent System initialized');
  }

  // Create AI opponent
  public createAIOpponent(
    name: string,
    team: Team,
    difficulty: AIDifficulty = AIDifficulty.MEDIUM,
    behavior: AIBehavior = AIBehavior.BALANCED
  ): AIPlayer | null {
    if (!this._world) return null;

    try {
      // Create a mock player object for the AI
      const mockPlayer: Player = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: name,
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
        setPosition: () => {},
        camera: {
          facingDirection: { x: 0, y: 0, z: 1 },
          offset: { x: 0, y: 0.5, z: 0 },
          setMode: () => {},
          setOffset: () => {},
          setModelHiddenNodes: () => {},
          setFieldOfView: () => {},
          getMode: () => 'first_person',
        },
        ui: {
          load: () => {},
        },
      } as any;

      // Create AI-enhanced player entity
      const aiPlayer = new DodgeballPlayerEntity(mockPlayer) as AIPlayer;
      aiPlayer.aiDifficulty = difficulty;
      aiPlayer.aiBehavior = behavior;
      aiPlayer.lastActionTime = Date.now();
      aiPlayer.decisionCooldown = this.getDecisionCooldown(difficulty);
      aiPlayer.throwCooldown = 0;
      aiPlayer.catchCooldown = 0;
      aiPlayer.personality = this.getPersonality(difficulty, behavior);

      // Set team
      aiPlayer.team = team;

      // Register AI player
      this._aiPlayers.set(mockPlayer.id, aiPlayer);

      // Spawn AI player
      const spawnPos = this.getAISpawnPosition(team);
      aiPlayer.spawn(this._world, spawnPos);

      console.log(`🤖 Created AI opponent: ${name} (${difficulty}, ${behavior})`);

      return aiPlayer;
    } catch (error) {
      console.error('❌ Failed to create AI opponent:', error);
      return null;
    }
  }

  // Remove AI opponent
  public removeAIOpponent(playerId: string): boolean {
    const aiPlayer = this._aiPlayers.get(playerId);
    if (!aiPlayer) return false;

    aiPlayer.despawn();
    this._aiPlayers.delete(playerId);

    console.log(`🤖 Removed AI opponent: ${aiPlayer.player.username}`);
    return true;
  }

  // Update AI behavior
  private updateAI(aiPlayer: AIPlayer, gameState: any): void {
    const now = Date.now();

    // Check decision cooldown
    if (now - aiPlayer.lastActionTime < aiPlayer.decisionCooldown) {
      return;
    }

    // Update AI state
    this.updateAIState(aiPlayer, gameState);

    // Execute AI strategy
    this.executeAIStrategy(aiPlayer, gameState);

    aiPlayer.lastActionTime = now;
  }

  private updateAIState(aiPlayer: AIPlayer, gameState: any): void {
    // Update throw and catch cooldowns
    if (aiPlayer.throwCooldown > 0) {
      aiPlayer.throwCooldown -= aiPlayer.decisionCooldown;
    }
    if (aiPlayer.catchCooldown > 0) {
      aiPlayer.catchCooldown -= aiPlayer.decisionCooldown;
    }

    // Find target player
    aiPlayer.targetPlayer = this.findBestTarget(aiPlayer, gameState);

    // Update movement target
    aiPlayer.movementTarget = this.calculateMovementTarget(aiPlayer, gameState);
  }

  private executeAIStrategy(aiPlayer: AIPlayer, gameState: any): void {
    // Find the highest priority strategy that meets conditions
    const applicableStrategy = this._strategies
      .filter(strategy => strategy.condition(aiPlayer, gameState))
      .sort((a, b) => b.priority - a.priority)[0];

    if (applicableStrategy) {
      applicableStrategy.action(aiPlayer, gameState);
    } else {
      // Default idle behavior
      this.performIdleBehavior(aiPlayer);
    }
  }

  private initializeStrategies(): void {
    this._strategies = [
      // High priority: Catch incoming dodgeballs
      {
        priority: 100,
        condition: (ai, gameState) => this.shouldCatch(ai, gameState),
        action: (ai, gameState) => this.performCatch(ai),
        cooldown: 200,
      },

      // High priority: Throw at target when opportunity arises
      {
        priority: 90,
        condition: (ai, gameState) => this.shouldThrow(ai, gameState),
        action: (ai, gameState) => this.performThrow(ai),
        cooldown: 1000,
      },

      // Medium priority: Move to strategic position
      {
        priority: 50,
        condition: (ai, gameState) => this.shouldMove(ai, gameState),
        action: (ai, gameState) => this.performMovement(ai),
        cooldown: 500,
      },

      // Low priority: Use power-up if available
      {
        priority: 30,
        condition: (ai, gameState) => this.shouldUsePowerUp(ai, gameState),
        action: (ai, gameState) => this.performPowerUp(ai),
        cooldown: 2000,
      },

      // Low priority: Dash to escape danger
      {
        priority: 20,
        condition: (ai, gameState) => this.shouldDash(ai, gameState),
        action: (ai, gameState) => this.performDash(ai),
        cooldown: 3000,
      },
    ];
  }

  // Strategy conditions
  private shouldCatch(ai: AIPlayer, gameState: any): boolean {
    if (ai.catchCooldown > 0) return false;

    // Check for catchable dodgeballs near the AI
    // Implementation would check for nearby dodgeballs
    return Math.random() < ai.personality.catchSkill * 0.3;
  }

  private shouldThrow(ai: AIPlayer, gameState: any): boolean {
    if (ai.throwCooldown > 0) return false;
    if (!ai.targetPlayer) return false;

    // Check if AI is aggressive enough and has line of sight
    const aggressionCheck = Math.random() < ai.personality.aggression;
    const accuracyCheck = Math.random() < ai.personality.accuracy;

    return aggressionCheck && accuracyCheck;
  }

  private shouldMove(ai: AIPlayer, gameState: any): boolean {
    return ai.movementTarget !== undefined;
  }

  private shouldUsePowerUp(ai: AIPlayer, gameState: any): boolean {
    // Check if AI has power-ups available
    return ai.activePowerUps.length > 0 && Math.random() < 0.2;
  }

  private shouldDash(ai: AIPlayer, gameState: any): boolean {
    // Check if AI is in danger
    return Math.random() < ai.personality.caution * 0.1;
  }

  // Strategy actions
  private performCatch(ai: AIPlayer): void {
    console.log(`🤖 ${ai.player.username} attempts to catch dodgeball`);
    // Implementation would trigger catch animation and logic
    ai.catchCooldown = 1000;
  }

  private performThrow(ai: AIPlayer): void {
    if (!ai.targetPlayer) return;

    console.log(`🤖 ${ai.player.username} throws at ${ai.targetPlayer.player.username}`);
    // Implementation would trigger throw animation and logic
    ai.throwCooldown = 2000;
  }

  private performMovement(ai: AIPlayer): void {
    if (!ai.movementTarget) return;

    // Move towards target position
    const direction = {
      x: ai.movementTarget.x - ai.position.x,
      y: 0,
      z: ai.movementTarget.z - ai.position.z,
    };

    // Normalize direction
    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (length > 0) {
      direction.x /= length;
      direction.z /= length;
    }

    // Apply movement
    const moveSpeed = ai.personality.movementSpeed * GameConfig.PLAYER_SPEED_WALK;
    ai.applyImpulse({
      x: direction.x * moveSpeed * 0.1,
      y: 0,
      z: direction.z * moveSpeed * 0.1,
    });
  }

  private performPowerUp(ai: AIPlayer): void {
    if (ai.activePowerUps.length === 0) return;

    const powerUpType = ai.activePowerUps[Math.floor(Math.random() * ai.activePowerUps.length)];
    console.log(`🤖 ${ai.player.username} uses ${powerUpType} power-up`);
    // Implementation would trigger power-up usage
  }

  private performDash(ai: AIPlayer): void {
    console.log(`🤖 ${ai.player.username} performs dash`);
    // Implementation would trigger dash ability
  }

  private performIdleBehavior(ai: AIPlayer): void {
    // Random movement or standing still
    if (Math.random() < 0.3) {
      ai.movementTarget = this.getRandomNearbyPosition(ai.position);
    }
  }

  // Helper methods
  private findBestTarget(ai: AIPlayer, gameState: any): DodgeballPlayerEntity | undefined {
    // Find closest enemy player
    const enemies = Array.from(GameManager.instance.getPlayerEntities())
      .filter(([id, player]) => player.team !== ai.team && player.isAlive)
      .map(([id, player]) => player);

    if (enemies.length === 0) return undefined;

    return enemies.reduce((closest, current) => {
      const closestDist = this.getDistance(ai.position, closest.position);
      const currentDist = this.getDistance(ai.position, current.position);
      return currentDist < closestDist ? current : closest;
    });
  }

  private calculateMovementTarget(ai: AIPlayer, gameState: any): Vector3Like | undefined {
    if (!ai.targetPlayer) return undefined;

    // Calculate strategic position relative to target
    const targetPos = ai.targetPlayer.position;
    const distance = this.getDistance(ai.position, targetPos);

    if (distance > 15) {
      // Too far, move closer
      return {
        x: targetPos.x + (Math.random() - 0.5) * 5,
        y: targetPos.y,
        z: targetPos.z + (Math.random() - 0.5) * 5,
      };
    } else if (distance < 8) {
      // Too close, back away
      const direction = {
        x: ai.position.x - targetPos.x,
        z: ai.position.z - targetPos.z,
      };
      const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
      if (length > 0) {
        direction.x /= length;
        direction.z /= length;
      }
      return {
        x: ai.position.x + direction.x * 3,
        y: ai.position.y,
        z: ai.position.z + direction.z * 3,
      };
    }

    // Good distance, slight random movement
    return {
      x: ai.position.x + (Math.random() - 0.5) * 2,
      y: ai.position.y,
      z: ai.position.z + (Math.random() - 0.5) * 2,
    };
  }

  private getAISpawnPosition(team: Team): Vector3Like {
    const baseX = team === Team.RED ? -15 : 15;
    const baseZ = (Math.random() - 0.5) * 20;

    return {
      x: baseX + (Math.random() - 0.5) * 4,
      y: 2,
      z: baseZ,
    };
  }

  private getDecisionCooldown(difficulty: AIDifficulty): number {
    const cooldowns = {
      [AIDifficulty.EASY]: 1500,
      [AIDifficulty.MEDIUM]: 1000,
      [AIDifficulty.HARD]: 700,
      [AIDifficulty.EXPERT]: 500,
      [AIDifficulty.NIGHTMARE]: 300,
    };
    return cooldowns[difficulty];
  }

  private getPersonality(difficulty: AIDifficulty, behavior: AIBehavior): AIPersonality {
    const basePersonality = {
      [AIDifficulty.EASY]: {
        aggression: 0.3,
        caution: 0.8,
        reactionTime: 1000,
        accuracy: 0.4,
        movementSpeed: 0.7,
        catchSkill: 0.3,
      },
      [AIDifficulty.MEDIUM]: {
        aggression: 0.5,
        caution: 0.6,
        reactionTime: 700,
        accuracy: 0.6,
        movementSpeed: 0.9,
        catchSkill: 0.5,
      },
      [AIDifficulty.HARD]: {
        aggression: 0.7,
        caution: 0.4,
        reactionTime: 500,
        accuracy: 0.8,
        movementSpeed: 1.1,
        catchSkill: 0.7,
      },
      [AIDifficulty.EXPERT]: {
        aggression: 0.8,
        caution: 0.3,
        reactionTime: 300,
        accuracy: 0.9,
        movementSpeed: 1.2,
        catchSkill: 0.8,
      },
      [AIDifficulty.NIGHTMARE]: {
        aggression: 0.9,
        caution: 0.2,
        reactionTime: 200,
        accuracy: 0.95,
        movementSpeed: 1.3,
        catchSkill: 0.9,
      },
    };

    const personality = { ...basePersonality[difficulty] };

    // Adjust based on behavior
    switch (behavior) {
      case AIBehavior.AGGRESSIVE:
        personality.aggression += 0.2;
        personality.caution -= 0.2;
        break;
      case AIBehavior.DEFENSIVE:
        personality.aggression -= 0.2;
        personality.caution += 0.2;
        personality.catchSkill += 0.2;
        break;
      case AIBehavior.CHAOTIC:
        personality.aggression = Math.random();
        personality.caution = Math.random();
        personality.accuracy = Math.random();
        break;
    }

    return personality;
  }

  private getRandomNearbyPosition(position: Vector3Like): Vector3Like {
    return {
      x: position.x + (Math.random() - 0.5) * 10,
      y: position.y,
      z: position.z + (Math.random() - 0.5) * 10,
    };
  }

  private getDistance(pos1: Vector3Like, pos2: Vector3Like): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  // Periodic AI updates
  private startAIUpdates(): void {
    this._aiUpdateInterval = setInterval(() => {
      this.updateAllAI();
    }, 100); // Update AI every 100ms for responsive behavior
  }

  private updateAllAI(): void {
    const gameState = GameManager.instance.getGameStats();

    for (const aiPlayer of this._aiPlayers.values()) {
      if (aiPlayer.isAlive) {
        this.updateAI(aiPlayer, gameState);
      }
    }
  }

  // Public API methods
  public getAIPlayers(): AIPlayer[] {
    return Array.from(this._aiPlayers.values());
  }

  public getAIPlayerCount(): number {
    return this._aiPlayers.size;
  }

  public getAIPlayersByDifficulty(difficulty: AIDifficulty): AIPlayer[] {
    return Array.from(this._aiPlayers.values())
      .filter(ai => ai.aiDifficulty === difficulty);
  }

  public getAIPlayersByBehavior(behavior: AIBehavior): AIPlayer[] {
    return Array.from(this._aiPlayers.values())
      .filter(ai => ai.aiBehavior === behavior);
  }

  public getAIStats(): any {
    const aiPlayers = Array.from(this._aiPlayers.values());
    const difficultyBreakdown = {
      [AIDifficulty.EASY]: aiPlayers.filter(ai => ai.aiDifficulty === AIDifficulty.EASY).length,
      [AIDifficulty.MEDIUM]: aiPlayers.filter(ai => ai.aiDifficulty === AIDifficulty.MEDIUM).length,
      [AIDifficulty.HARD]: aiPlayers.filter(ai => ai.aiDifficulty === AIDifficulty.HARD).length,
      [AIDifficulty.EXPERT]: aiPlayers.filter(ai => ai.aiDifficulty === AIDifficulty.EXPERT).length,
      [AIDifficulty.NIGHTMARE]: aiPlayers.filter(ai => ai.aiDifficulty === AIDifficulty.NIGHTMARE).length,
    };

    return {
      totalAI: aiPlayers.length,
      activeAI: aiPlayers.filter(ai => ai.isAlive).length,
      difficultyBreakdown,
      averageSkill: aiPlayers.reduce((sum, ai) => sum + this.getAISkillRating(ai), 0) / Math.max(aiPlayers.length, 1),
    };
  }

  private getAISkillRating(ai: AIPlayer): number {
    const difficultyMultiplier = {
      [AIDifficulty.EASY]: 1,
      [AIDifficulty.MEDIUM]: 2,
      [AIDifficulty.HARD]: 3,
      [AIDifficulty.EXPERT]: 4,
      [AIDifficulty.NIGHTMARE]: 5,
    };

    return difficultyMultiplier[ai.aiDifficulty] * (ai.personality.accuracy + ai.personality.catchSkill) / 2;
  }

  // Cleanup
  public cleanup(): void {
    if (this._aiUpdateInterval) {
      clearInterval(this._aiUpdateInterval);
      this._aiUpdateInterval = undefined;
    }

    // Remove all AI players
    for (const aiPlayer of this._aiPlayers.values()) {
      aiPlayer.despawn();
    }

    this._aiPlayers.clear();
    console.log('🤖 AI Opponent System cleaned up');
  }
}
