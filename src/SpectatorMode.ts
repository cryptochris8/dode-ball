/**
 * 👁️ Spectator Mode
 *
 * Allows players to watch games without participating, with multiple viewing options
 * and interactive features.
 */

import {
  Player,
  World,
  Vector3Like,
} from 'hytopia';

import GameManager from './GameManager.ts';
import TournamentManager from './TournamentManager.ts';

export enum SpectatorCameraMode {
  FREE = 'free',           // Free camera movement
  FOLLOW = 'follow',       // Follow a specific player
  OVERVIEW = 'overview',   // Overview of the entire arena
  CINEMATIC = 'cinematic', // Automatic cinematic camera
  MULTI_VIEW = 'multi_view', // Multiple camera angles
}

interface Spectator {
  player: Player;
  cameraMode: SpectatorCameraMode;
  followTarget?: Player;
  cameraPosition: Vector3Like;
  cameraRotation: Vector3Like;
  isActive: boolean;
  joinTime: number;
  preferences: SpectatorPreferences;
}

interface SpectatorPreferences {
  showEliminations: boolean;
  showPowerUps: boolean;
  showStats: boolean;
  autoSwitchTargets: boolean;
  cameraSpeed: number;
  showUI: boolean;
}

interface SpectatorMatch {
  id: string;
  gameManager: GameManager;
  spectators: Spectator[];
  startTime: number;
  viewCount: number;
  isTournamentMatch: boolean;
  tournamentId?: string;
}

export default class SpectatorMode {
  private static _instance: SpectatorMode;
  private _world: World | undefined;
  private _spectators: Map<string, Spectator> = new Map();
  private _spectatorMatches: Map<string, SpectatorMatch> = new Map();
  private _spectatorUpdateInterval: NodeJS.Timeout | undefined;

  public static get instance(): SpectatorMode {
    if (!this._instance) {
      this._instance = new SpectatorMode();
    }
    return this._instance;
  }

  private constructor() {}

  public initialize(world: World): void {
    this._world = world;
    this.startSpectatorUpdates();
    console.log('👁️ Spectator Mode initialized');
  }

  // Enable spectator mode for a player
  public enableSpectatorMode(player: Player, matchId?: string): boolean {
    if (!this._world) return false;

    try {
      // Create spectator profile
      const spectator: Spectator = {
        player,
        cameraMode: SpectatorCameraMode.OVERVIEW,
        cameraPosition: { x: 0, y: 15, z: 0 },
        cameraRotation: { x: -Math.PI / 4, y: 0, z: 0 },
        isActive: true,
        joinTime: Date.now(),
        preferences: this.getDefaultPreferences(),
      };

      this._spectators.set(player.id, spectator);

      // Set up spectator camera
      this.setupSpectatorCamera(spectator);

      // Send welcome message
      this.sendSpectatorMessage(
        player,
        '👁️ Welcome to Spectator Mode!',
        '00FF00'
      );

      this.sendSpectatorMessage(
        player,
        'Controls: Mouse (Look), WASD (Move camera in free mode), C (Change camera mode)',
        'FFFF00'
      );

      // Add to match if specified
      if (matchId) {
        this.addSpectatorToMatch(player, matchId);
      }

      console.log(`👁️ ${player.username} entered spectator mode`);

      return true;
    } catch (error) {
      console.error(`❌ Failed to enable spectator mode for ${player.username}:`, error);
      return false;
    }
  }

  // Disable spectator mode for a player
  public disableSpectatorMode(player: Player): boolean {
    const spectator = this._spectators.get(player.id);
    if (!spectator) return false;

    try {
      // Remove from match
      this.removeSpectatorFromMatch(player);

      // Reset player to normal state
      this.resetPlayerFromSpectator(spectator);

      // Remove spectator
      this._spectators.delete(player.id);

      this.sendSpectatorMessage(
        player,
        '👋 Exited Spectator Mode',
        'FF0000'
      );

      console.log(`👋 ${player.username} exited spectator mode`);

      return true;
    } catch (error) {
      console.error(`❌ Failed to disable spectator mode for ${player.username}:`, error);
      return false;
    }
  }

  // Change spectator camera mode
  public changeCameraMode(player: Player, mode: SpectatorCameraMode): boolean {
    const spectator = this._spectators.get(player.id);
    if (!spectator) return false;

    spectator.cameraMode = mode;

    // Update camera based on new mode
    this.updateSpectatorCamera(spectator);

    // Send feedback message
    const modeNames = {
      [SpectatorCameraMode.FREE]: 'Free Camera',
      [SpectatorCameraMode.FOLLOW]: 'Follow Player',
      [SpectatorCameraMode.OVERVIEW]: 'Arena Overview',
      [SpectatorCameraMode.CINEMATIC]: 'Cinematic',
      [SpectatorCameraMode.MULTI_VIEW]: 'Multi-View',
    };

    this.sendSpectatorMessage(
      player,
      `📷 Camera mode: ${modeNames[mode]}`,
      '00CED1'
    );

    return true;
  }

  // Set follow target for spectator
  public setFollowTarget(player: Player, targetPlayer: Player): boolean {
    const spectator = this._spectators.get(player.id);
    if (!spectator) return false;

    spectator.followTarget = targetPlayer;
    spectator.cameraMode = SpectatorCameraMode.FOLLOW;
    this.updateSpectatorCamera(spectator);

    this.sendSpectatorMessage(
      player,
      `👤 Now following: ${targetPlayer.username}`,
      '9932CC'
    );

    return true;
  }

  // Update spectator preferences
  public updatePreferences(player: Player, preferences: Partial<SpectatorPreferences>): boolean {
    const spectator = this._spectators.get(player.id);
    if (!spectator) return false;

    spectator.preferences = { ...spectator.preferences, ...preferences };

    this.sendSpectatorMessage(
      player,
      '⚙️ Preferences updated',
      '00FF00'
    );

    return true;
  }

  // Private helper methods
  private setupSpectatorCamera(spectator: Spectator): void {
    if (!this._world) return;

    // Set player to spectator state
    spectator.player.setPosition(spectator.cameraPosition);
    spectator.player.camera.setMode('first_person');
    spectator.player.camera.setOffset({ x: 0, y: 0, z: 0 });

    // Update camera based on mode
    this.updateSpectatorCamera(spectator);
  }

  private updateSpectatorCamera(spectator: Spectator): void {
    if (!this._world) return;

    switch (spectator.cameraMode) {
      case SpectatorCameraMode.OVERVIEW:
        this.setOverviewCamera(spectator);
        break;
      case SpectatorCameraMode.FOLLOW:
        this.setFollowCamera(spectator);
        break;
      case SpectatorCameraMode.CINEMATIC:
        this.setCinematicCamera(spectator);
        break;
      case SpectatorCameraMode.FREE:
        this.setFreeCamera(spectator);
        break;
      case SpectatorCameraMode.MULTI_VIEW:
        this.setMultiViewCamera(spectator);
        break;
    }
  }

  private setOverviewCamera(spectator: Spectator): void {
    // High overview of the entire arena
    spectator.cameraPosition = { x: 0, y: 25, z: 0 };
    spectator.cameraRotation = { x: -Math.PI / 2, y: 0, z: 0 };
    spectator.player.setPosition(spectator.cameraPosition);
  }

  private setFollowCamera(spectator: Spectator): void {
    if (!spectator.followTarget) {
      // Default to overview if no target
      this.setOverviewCamera(spectator);
      return;
    }

    // Follow the target player with some offset
    const targetPos = spectator.followTarget.getPosition();
    spectator.cameraPosition = {
      x: targetPos.x,
      y: targetPos.y + 5,
      z: targetPos.z + 8,
    };
    spectator.player.setPosition(spectator.cameraPosition);
  }

  private setCinematicCamera(spectator: Spectator): void {
    // Automatically move camera in cinematic patterns
    const time = Date.now() * 0.001; // Convert to seconds
    spectator.cameraPosition = {
      x: Math.sin(time * 0.5) * 20,
      y: 15 + Math.sin(time * 0.3) * 5,
      z: Math.cos(time * 0.5) * 20,
    };
    spectator.cameraRotation = {
      x: -Math.PI / 4 + Math.sin(time * 0.2) * 0.2,
      y: time * 0.3,
      z: 0,
    };
    spectator.player.setPosition(spectator.cameraPosition);
  }

  private setFreeCamera(spectator: Spectator): void {
    // Allow free movement (handled by player controls)
    this.sendSpectatorMessage(
      spectator.player,
      '🎮 Free camera mode: Use WASD to move, mouse to look around',
      'FFFF00'
    );
  }

  private setMultiViewCamera(spectator: Spectator): void {
    // Cycle through multiple camera angles
    const views = [
      { pos: { x: 0, y: 25, z: 0 }, rot: { x: -Math.PI / 2, y: 0, z: 0 } }, // Overview
      { pos: { x: 20, y: 10, z: 0 }, rot: { x: -Math.PI / 6, y: -Math.PI / 2, z: 0 } }, // Side view
      { pos: { x: 0, y: 10, z: 20 }, rot: { x: -Math.PI / 6, y: 0, z: 0 } }, // End view
      { pos: { x: -20, y: 15, z: 0 }, rot: { x: -Math.PI / 4, y: Math.PI / 2, z: 0 } }, // Opposite side
    ];

    const currentTime = Date.now();
    const viewIndex = Math.floor((currentTime / 10000) % views.length); // Change every 10 seconds
    const view = views[viewIndex];

    spectator.cameraPosition = view.pos;
    spectator.cameraRotation = view.rot;
    spectator.player.setPosition(spectator.cameraPosition);
  }

  private addSpectatorToMatch(player: Player, matchId: string): void {
    let match = this._spectatorMatches.get(matchId);

    if (!match) {
      // Create new spectator match
      const gameManager = GameManager.instance; // Could be specific to tournament matches
      match = {
        id: matchId,
        gameManager,
        spectators: [],
        startTime: Date.now(),
        viewCount: 0,
        isTournamentMatch: false,
      };
      this._spectatorMatches.set(matchId, match);
    }

    // Add spectator to match
    const spectator = this._spectators.get(player.id);
    if (spectator && !match.spectators.find(s => s.player.id === player.id)) {
      match.spectators.push(spectator);
      match.viewCount++;
    }

    this.sendSpectatorMessage(
      player,
      `📺 Watching match: ${matchId}`,
      'FFD700'
    );
  }

  private removeSpectatorFromMatch(player: Player): void {
    for (const [matchId, match] of this._spectatorMatches) {
      const spectatorIndex = match.spectators.findIndex(s => s.player.id === player.id);
      if (spectatorIndex !== -1) {
        match.spectators.splice(spectatorIndex, 1);
        match.viewCount = Math.max(0, match.viewCount - 1);

        // Clean up empty matches
        if (match.spectators.length === 0) {
          this._spectatorMatches.delete(matchId);
        }
        break;
      }
    }
  }

  private resetPlayerFromSpectator(spectator: Spectator): void {
    // Reset player to normal gameplay state
    spectator.player.camera.setMode('first_person');
    spectator.player.camera.setOffset({ x: 0, y: 0.5, z: 0 });

    // Could respawn player if they want to join the game
  }

  private getDefaultPreferences(): SpectatorPreferences {
    return {
      showEliminations: true,
      showPowerUps: true,
      showStats: true,
      autoSwitchTargets: false,
      cameraSpeed: 1.0,
      showUI: true,
    };
  }

  // Periodic updates for spectators
  private startSpectatorUpdates(): void {
    this._spectatorUpdateInterval = setInterval(() => {
      this.updateSpectators();
    }, 100); // 10 FPS for smooth camera movement
  }

  private updateSpectators(): void {
    for (const spectator of this._spectators.values()) {
      if (spectator.isActive) {
        this.updateSpectatorCamera(spectator);

        // Update UI elements if enabled
        if (spectator.preferences.showStats) {
          this.updateSpectatorUI(spectator);
        }
      }
    }
  }

  private updateSpectatorUI(spectator: Spectator): void {
    // Update spectator-specific UI elements
    // This would integrate with the main UI system
  }

  // Communication methods
  private sendSpectatorMessage(player: Player, message: string, color: string = 'FFFFFF'): void {
    if (this._world) {
      this._world.chatManager.sendPlayerMessage(player, message, color);
    }
  }

  private broadcastSpectatorMessage(message: string, color: string = 'FFFFFF'): void {
    for (const spectator of this._spectators.values()) {
      if (spectator.isActive) {
        this.sendSpectatorMessage(spectator.player, message, color);
      }
    }
  }

  // Public API methods
  public isPlayerSpectating(playerId: string): boolean {
    return this._spectators.has(playerId);
  }

  public getSpectator(playerId: string): Spectator | undefined {
    return this._spectators.get(playerId);
  }

  public getSpectatorCount(): number {
    return this._spectators.size;
  }

  public getActiveSpectators(): Spectator[] {
    return Array.from(this._spectators.values()).filter(s => s.isActive);
  }

  public getSpectatorMatches(): SpectatorMatch[] {
    return Array.from(this._spectatorMatches.values());
  }

  public getMatchSpectatorCount(matchId: string): number {
    const match = this._spectatorMatches.get(matchId);
    return match ? match.viewCount : 0;
  }

  // Tournament integration
  public createTournamentSpectatorMatch(tournamentId: string, matchId: string): void {
    const match: SpectatorMatch = {
      id: matchId,
      gameManager: GameManager.instance, // Could be specific tournament game manager
      spectators: [],
      startTime: Date.now(),
      viewCount: 0,
      isTournamentMatch: true,
      tournamentId,
    };

    this._spectatorMatches.set(matchId, match);

    this.broadcastSpectatorMessage(
      `🏆 Tournament match "${matchId}" is now available for spectating!`,
      'FFD700'
    );
  }

  // Statistics and analytics
  public getSpectatorStats(): any {
    const totalSpectators = this._spectators.size;
    const activeSpectators = this.getActiveSpectators().length;
    const totalMatches = this._spectatorMatches.size;
    const averageViewTime = this.calculateAverageViewTime();

    return {
      totalSpectators,
      activeSpectators,
      totalMatches,
      averageViewTime,
      spectatorRetention: activeSpectators / Math.max(totalSpectators, 1),
      popularMatches: this.getPopularMatches(),
    };
  }

  private calculateAverageViewTime(): number {
    const spectators = Array.from(this._spectators.values());
    if (spectators.length === 0) return 0;

    const totalViewTime = spectators.reduce(
      (total, spectator) => total + (Date.now() - spectator.joinTime),
      0
    );

    return totalViewTime / spectators.length;
  }

  private getPopularMatches(): any[] {
    return Array.from(this._spectatorMatches.values())
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5)
      .map(match => ({
        matchId: match.id,
        spectators: match.viewCount,
        isTournamentMatch: match.isTournamentMatch,
        duration: Date.now() - match.startTime,
      }));
  }

  // Cleanup
  public cleanup(): void {
    if (this._spectatorUpdateInterval) {
      clearInterval(this._spectatorUpdateInterval);
      this._spectatorUpdateInterval = undefined;
    }

    // Disable all spectators
    for (const spectator of this._spectators.values()) {
      this.disableSpectatorMode(spectator.player);
    }

    this._spectators.clear();
    this._spectatorMatches.clear();

    console.log('👁️ Spectator Mode cleaned up');
  }
}
