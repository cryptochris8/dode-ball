/**
 * 🎤 Voice Chat Manager
 *
 * Handles team-based voice communication with spatial audio support
 */

import { World, Player, Audio, Entity } from 'hytopia';
import { Team, VOICE_CHAT_CONFIG } from './GameConfig.ts';

export enum VoiceChatMode {
  OFF = 'off',
  TEAM = 'team',
  GLOBAL = 'global',
  PROXIMITY = 'proximity',
}

export interface VoiceMessage {
  id: string;
  playerId: string;
  playerName: string;
  team: Team;
  mode: VoiceChatMode;
  audioUri?: string;
  timestamp: number;
  duration: number;
}

export interface PlayerVoiceSettings {
  mode: VoiceChatMode;
  volume: number;
  muted: boolean;
  deafened: boolean;
  voiceActivityEnabled: boolean;
}

export default class VoiceChatManager {
  private static _instance: VoiceChatManager;
  private world: World | undefined;
  private activeVoiceMessages: Map<string, VoiceMessage> = new Map();
  private playerSettings: Map<string, PlayerVoiceSettings> = new Map();
  private voiceCooldowns: Map<string, number> = new Map();
  private voiceEntities: Map<string, Entity> = new Map();

  // Default settings for new players
  private defaultSettings: PlayerVoiceSettings = {
    mode: VoiceChatMode.TEAM,
    volume: 1.0,
    muted: false,
    deafened: false,
    voiceActivityEnabled: true,
  };

  public static get instance(): VoiceChatManager {
    if (!VoiceChatManager._instance) {
      VoiceChatManager._instance = new VoiceChatManager();
    }
    return VoiceChatManager._instance;
  }

  public initialize(world: World): void {
    this.world = world;
    console.log('🎤 Voice Chat Manager initialized');

    // Set up periodic cleanup of expired voice messages
    setInterval(() => {
      this.cleanupExpiredMessages();
    }, 5000);
  }

  /**
   * Initialize voice settings for a player
   */
  public initializePlayerVoice(player: Player): void {
    const playerId = player.id;
    if (!this.playerSettings.has(playerId)) {
      this.playerSettings.set(playerId, { ...this.defaultSettings });
      console.log(`🎤 Initialized voice settings for ${player.username}`);
    }

    // Create a voice entity for spatial audio positioning
    this.createVoiceEntity(player);
  }

  /**
   * Create a voice entity for spatial audio positioning
   */
  private createVoiceEntity(player: Player): void {
    const playerId = player.id;

    // Remove existing voice entity if it exists
    if (this.voiceEntities.has(playerId)) {
      const existingEntity = this.voiceEntities.get(playerId);
      if (existingEntity && this.world) {
        this.world.removeEntity(existingEntity);
      }
    }

    // Create new voice entity (invisible, used for spatial audio positioning)
    const voiceEntity = new Entity({
      name: `Voice_${player.username}`,
      modelUri: '', // No visual model
    });

    // Position it at the player's location
    const playerEntity = (player as any).entity;
    if (playerEntity) {
      voiceEntity.spawn(this.world!, playerEntity.position);
    }

    this.voiceEntities.set(playerId, voiceEntity);
  }

  /**
   * Update voice entity position to follow player
   */
  public updatePlayerPosition(player: Player): void {
    const playerId = player.id;
    const voiceEntity = this.voiceEntities.get(playerId);
    const playerEntity = (player as any).entity;

    if (voiceEntity && playerEntity && this.world) {
      voiceEntity.position = playerEntity.position;
    }
  }

  /**
   * Handle voice message from a player
   */
  public handleVoiceMessage(
    player: Player,
    audioUri: string,
    duration: number
  ): boolean {
    const playerId = player.id;
    const settings = this.playerSettings.get(playerId);

    if (!settings) {
      console.error(`❌ Voice settings not found for player ${player.username}`);
      return false;
    }

    // Check if player is muted or voice chat is disabled
    if (settings.muted || settings.mode === VoiceChatMode.OFF) {
      return false;
    }

    // Check cooldown
    const now = Date.now();
    const lastMessageTime = this.voiceCooldowns.get(playerId) || 0;
    if (now - lastMessageTime < VOICE_CHAT_CONFIG.VOICE_CHAT_COOLDOWN_MS) {
      return false; // Still on cooldown
    }

    // Validate duration
    const clampedDuration = Math.min(
      duration,
      VOICE_CHAT_CONFIG.MAX_VOICE_DURATION_MS
    );

    // Create voice message
    const voiceMessage: VoiceMessage = {
      id: `voice_${playerId}_${now}`,
      playerId,
      playerName: player.username,
      team: (player as any).team || Team.RED, // Get from player entity
      mode: settings.mode,
      audioUri,
      timestamp: now,
      duration: clampedDuration,
    };

    // Store active message
    this.activeVoiceMessages.set(voiceMessage.id, voiceMessage);
    this.voiceCooldowns.set(playerId, now);

    // Broadcast to appropriate recipients
    this.broadcastVoiceMessage(voiceMessage);

    // Auto-cleanup after message duration
    setTimeout(() => {
      this.activeVoiceMessages.delete(voiceMessage.id);
    }, clampedDuration + 1000); // Extra second for cleanup

    console.log(`🎤 Voice message from ${player.username} (${settings.mode}): ${clampedDuration}ms`);
    return true;
  }

  /**
   * Broadcast voice message to appropriate recipients
   */
  private broadcastVoiceMessage(message: VoiceMessage): void {
    if (!this.world) return;

    const speakerEntity = this.voiceEntities.get(message.playerId);
    if (!speakerEntity) return;

    // Get all players who should hear this message
    const recipients = this.getMessageRecipients(message);

    recipients.forEach(recipient => {
      const recipientSettings = this.playerSettings.get(recipient.id);

      // Skip if recipient is deafened
      if (recipientSettings?.deafened) return;

      // Calculate volume based on distance and settings
      const volume = this.calculateVoiceVolume(
        speakerEntity,
        recipient,
        message,
        recipientSettings?.volume || 1.0
      );

      // Skip if volume is too low to hear
      if (volume < 0.01) return;

      // Create spatial audio for the recipient
      const voiceAudio = new Audio({
        uri: message.audioUri!,
        volume: volume,
        attachedToEntity: speakerEntity,
        referenceDistance: this.getReferenceDistance(message.mode),
        loop: false,
      });

      // Play the voice audio for this specific recipient
      voiceAudio.play(this.world, true);

      // Send UI notification about voice message
      if (this.world.chatManager) {
        this.world.chatManager.sendPlayerMessage(
          recipient,
          `🎤 ${message.playerName} is speaking...`,
          '00FFFF'
        );
      }
    });
  }

  /**
   * Get recipients who should hear the voice message
   */
  private getMessageRecipients(message: VoiceMessage): Player[] {
    if (!this.world) return [];

    const allPlayers = Array.from(this.world.players.values());
    const speaker = allPlayers.find(p => p.id === message.playerId);

    if (!speaker) return [];

    switch (message.mode) {
      case VoiceChatMode.TEAM:
        // Only team members
        return allPlayers.filter(p => {
          const playerEntity = (p as any).entity;
          return playerEntity?.team === message.team;
        });

      case VoiceChatMode.GLOBAL:
        // All players
        return allPlayers;

      case VoiceChatMode.PROXIMITY:
        // Players within proximity distance
        const speakerEntity = this.voiceEntities.get(message.playerId);
        if (!speakerEntity) return [];

        return allPlayers.filter(p => {
          if (p.id === message.playerId) return false; // Don't send to self

          const playerEntity = this.voiceEntities.get(p.id);
          if (!playerEntity) return false;

          const distance = this.calculateDistance(speakerEntity.position, playerEntity.position);
          return distance <= VOICE_CHAT_CONFIG.MAX_VOICE_DISTANCE;
        });

      default:
        return [];
    }
  }

  /**
   * Calculate voice volume based on distance and settings
   */
  private calculateVoiceVolume(
    speakerEntity: Entity,
    listener: Player,
    message: VoiceMessage,
    listenerVolume: number
  ): number {
    const listenerEntity = this.voiceEntities.get(listener.id);
    if (!listenerEntity) return 0;

    const distance = this.calculateDistance(speakerEntity.position, listenerEntity.position);
    const maxDistance = this.getMaxDistance(message.mode);
    const fadeStart = this.getFadeStart(message.mode);

    // If beyond max distance, no sound
    if (distance > maxDistance) return 0;

    // If within fade start distance, full volume
    if (distance <= fadeStart) {
      return VOICE_CHAT_CONFIG.VOICE_VOLUME_NEAR * listenerVolume;
    }

    // Calculate fade between fade start and max distance
    const fadeRange = maxDistance - fadeStart;
    const distanceInFade = distance - fadeStart;
    const fadeFactor = 1 - (distanceInFade / fadeRange);

    const volume = VOICE_CHAT_CONFIG.VOICE_VOLUME_NEAR +
      (VOICE_CHAT_CONFIG.VOICE_VOLUME_FAR - VOICE_CHAT_CONFIG.VOICE_VOLUME_NEAR) * (1 - fadeFactor);

    return Math.max(volume * listenerVolume, VOICE_CHAT_CONFIG.VOICE_VOLUME_FAR);
  }

  /**
   * Get maximum distance for a voice mode
   */
  private getMaxDistance(mode: VoiceChatMode): number {
    switch (mode) {
      case VoiceChatMode.TEAM:
        return VOICE_CHAT_CONFIG.TEAM_VOICE_DISTANCE;
      case VoiceChatMode.GLOBAL:
        return VOICE_CHAT_CONFIG.GLOBAL_VOICE_DISTANCE;
      case VoiceChatMode.PROXIMITY:
        return VOICE_CHAT_CONFIG.MAX_VOICE_DISTANCE;
      default:
        return 0;
    }
  }

  /**
   * Get fade start distance for a voice mode
   */
  private getFadeStart(mode: VoiceChatMode): number {
    switch (mode) {
      case VoiceChatMode.TEAM:
        return VOICE_CHAT_CONFIG.TEAM_VOICE_FADE_START;
      case VoiceChatMode.PROXIMITY:
      case VoiceChatMode.GLOBAL:
        return VOICE_CHAT_CONFIG.VOICE_FADE_START;
      default:
        return 0;
    }
  }

  /**
   * Get reference distance for spatial audio
   */
  private getReferenceDistance(mode: VoiceChatMode): number {
    switch (mode) {
      case VoiceChatMode.TEAM:
        return VOICE_CHAT_CONFIG.TEAM_VOICE_DISTANCE;
      case VoiceChatMode.GLOBAL:
        return VOICE_CHAT_CONFIG.GLOBAL_VOICE_DISTANCE;
      case VoiceChatMode.PROXIMITY:
        return VOICE_CHAT_CONFIG.MAX_VOICE_DISTANCE;
      default:
        return VOICE_CHAT_CONFIG.MAX_VOICE_DISTANCE;
    }
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: any, pos2: any): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Update player voice settings
   */
  public updatePlayerSettings(
    playerId: string,
    settings: Partial<PlayerVoiceSettings>
  ): boolean {
    const currentSettings = this.playerSettings.get(playerId);
    if (!currentSettings) return false;

    // Update settings
    Object.assign(currentSettings, settings);
    this.playerSettings.set(playerId, currentSettings);

    console.log(`🎤 Updated voice settings for player ${playerId}:`, settings);
    return true;
  }

  /**
   * Get player voice settings
   */
  public getPlayerSettings(playerId: string): PlayerVoiceSettings | undefined {
    return this.playerSettings.get(playerId);
  }

  /**
   * Toggle mute for a player
   */
  public toggleMute(playerId: string): boolean {
    const settings = this.playerSettings.get(playerId);
    if (!settings) return false;

    settings.muted = !settings.muted;
    console.log(`🎤 ${settings.muted ? 'Muted' : 'Unmuted'} player ${playerId}`);
    return settings.muted;
  }

  /**
   * Toggle deafen for a player
   */
  public toggleDeafen(playerId: string): boolean {
    const settings = this.playerSettings.get(playerId);
    if (!settings) return false;

    settings.deafened = !settings.deafened;
    console.log(`🎤 ${settings.deafened ? 'Deafened' : 'Undeafened'} player ${playerId}`);
    return settings.deafened;
  }

  /**
   * Set voice mode for a player
   */
  public setVoiceMode(playerId: string, mode: VoiceChatMode): boolean {
    const settings = this.playerSettings.get(playerId);
    if (!settings) return false;

    settings.mode = mode;
    console.log(`🎤 Set voice mode for player ${playerId} to ${mode}`);
    return true;
  }

  /**
   * Clean up expired voice messages
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    const expiredMessages: string[] = [];

    this.activeVoiceMessages.forEach((message, id) => {
      if (now - message.timestamp > message.duration + 5000) {
        expiredMessages.push(id);
      }
    });

    expiredMessages.forEach(id => {
      this.activeVoiceMessages.delete(id);
    });

    if (expiredMessages.length > 0) {
      console.log(`🧹 Cleaned up ${expiredMessages.length} expired voice messages`);
    }
  }

  /**
   * Remove player from voice chat system
   */
  public removePlayer(playerId: string): void {
    // Remove voice entity
    const voiceEntity = this.voiceEntities.get(playerId);
    if (voiceEntity && this.world) {
      this.world.removeEntity(voiceEntity);
    }

    // Clean up data
    this.voiceEntities.delete(playerId);
    this.playerSettings.delete(playerId);
    this.voiceCooldowns.delete(playerId);

    // Clean up any active messages from this player
    const playerMessages: string[] = [];
    this.activeVoiceMessages.forEach((message, id) => {
      if (message.playerId === playerId) {
        playerMessages.push(id);
      }
    });

    playerMessages.forEach(id => {
      this.activeVoiceMessages.delete(id);
    });

    console.log(`🎤 Removed player ${playerId} from voice chat system`);
  }

  /**
   * Get voice statistics
   */
  public getVoiceStats(): any {
    return {
      activeMessages: this.activeVoiceMessages.size,
      totalPlayers: this.playerSettings.size,
      voiceEntities: this.voiceEntities.size,
      modeDistribution: this.getModeDistribution(),
    };
  }

  /**
   * Get distribution of voice modes
   */
  private getModeDistribution(): Record<VoiceChatMode, number> {
    const distribution = {
      [VoiceChatMode.OFF]: 0,
      [VoiceChatMode.TEAM]: 0,
      [VoiceChatMode.GLOBAL]: 0,
      [VoiceChatMode.PROXIMITY]: 0,
    };

    this.playerSettings.forEach(settings => {
      distribution[settings.mode]++;
    });

    return distribution;
  }

  /**
   * Clean up all voice chat resources
   */
  public cleanup(): void {
    // Remove all voice entities
    if (this.world) {
      this.voiceEntities.forEach(entity => {
        this.world!.removeEntity(entity);
      });
    }

    // Clear all data
    this.activeVoiceMessages.clear();
    this.playerSettings.clear();
    this.voiceCooldowns.clear();
    this.voiceEntities.clear();

    console.log('🎤 Voice Chat Manager cleaned up');
  }
}
