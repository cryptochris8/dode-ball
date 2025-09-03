/**
 * 🎯 Ultimate Dodgeball Arena Configuration
 *
 * Comprehensive game configuration with multiple game modes, power-ups,
 * and balanced gameplay mechanics.
 */

export enum GameMode {
  CLASSIC = 'classic',         // Traditional dodgeball
  SURVIVAL = 'survival',       // Last team standing
  TIME_ATTACK = 'time_attack', // Score as many eliminations as possible
  POWER_UP_MADNESS = 'power_up_madness', // Frequent power-ups
  CHAOS = 'chaos'             // Random events and power-ups
}

// Game state enumeration
export enum GameState {
  WAITING = 'waiting',
  STARTING = 'starting',
  PLAYING = 'playing',
  ENDING = 'ending'
}

// Team enumeration
export enum Team {
  RED = 'red',
  BLUE = 'blue'
}

export enum PowerUpType {
  SPEED_BOOST = 'speed_boost',
  INVISIBILITY = 'invisibility',
  MULTI_THROW = 'multi_throw',
  SHIELD = 'shield',
  TELEPORT = 'teleport',
  FREEZE = 'freeze',
  MAGNET = 'magnet',
  TIME_SLOW = 'time_slow'
}

export enum AchievementType {
  FIRST_BLOOD = 'first_blood',
  DOUBLE_KILL = 'double_kill',
  TRIPLE_KILL = 'triple_kill',
  SURVIVOR = 'survivor',
  TEAM_PLAYER = 'team_player',
  CATCH_MASTER = 'catch_master',
  POWER_UP_COLLECTOR = 'power_up_collector'
}

export const GameConfig = {
  // 🎮 Core Game Settings
  MIN_PLAYERS_TO_START: 2,
  MAX_PLAYERS: 16,
  COUNTDOWN_SECONDS: 5,
  ROUND_TIME_MS: 4 * 60 * 1000, // 4 minutes
  ROUND_END_DELAY_MS: 3000, // 3 seconds

  // 🏐 Dodgeball Physics & Mechanics
  DODGEBALL_COUNT: 8,
  DODGEBALL_DAMAGE: 100,
  DODGEBALL_SPEED: 25,
  DODGEBALL_CATCH_WINDOW_MS: 250,
  DODGEBALL_MAX_BOUNCES: 3,
  DODGEBALL_LIFETIME_MS: 15000,

  // 🏃 Player Movement
  PLAYER_SPEED_WALK: 6,
  PLAYER_SPEED_RUN: 12,
  PLAYER_SPEED_SPRINT: 18,
  PLAYER_JUMP_HEIGHT: 12,
  PLAYER_DASH_DISTANCE: 8,
  PLAYER_DASH_COOLDOWN_MS: 2000,

  // 🛡️ Combat System
  PLAYER_HEALTH: 100,
  PLAYER_SHIELD: 50,
  PLAYER_RESPAWN_TIME_MS: 3000,
  FRIENDLY_FIRE: false,
  SELF_THROW_DAMAGE: false,

  // 🏟️ Arena Configuration
  FIELD_CENTER_Z: 0,
  FIELD_MIN_X: -35,
  FIELD_MAX_X: 35,
  FIELD_MIN_Z: -40,
  FIELD_MAX_Z: 40,
  SPAWN_SAFE_RADIUS: 5,

  // ⚡ Power-up System
  POWER_UP_SPAWN_RATE_MS: 15000,
  POWER_UP_DURATION_MS: 8000,
  POWER_UP_MAX_ACTIVE: 5,

  // 🎯 Special Abilities
  SPECIAL_ABILITY_COOLDOWN_MS: 10000,
  SPECIAL_ABILITY_DURATION_MS: 5000,

  // 📊 Scoring System
  SCORE_ELIMINATION: 10,
  SCORE_ASSIST: 5,
  SCORE_CATCH: 3,
  SCORE_POWER_UP: 2,
  SCORE_SURVIVAL: 1,

  // 🎮 Game Mode Specific Settings
  GAME_MODES: {
    [GameMode.CLASSIC]: {
      name: 'Classic Dodgeball',
      description: 'Traditional team-based dodgeball with eliminations',
      timeLimit: 4 * 60 * 1000,
      powerUpsEnabled: true,
      specialAbilities: false,
    },
    [GameMode.SURVIVAL]: {
      name: 'Survival Mode',
      description: 'Last team standing wins!',
      timeLimit: 0, // No time limit
      powerUpsEnabled: true,
      specialAbilities: true,
      maxRounds: 5,
    },
    [GameMode.TIME_ATTACK]: {
      name: 'Time Attack',
      description: 'Score as many eliminations as possible in the time limit',
      timeLimit: 2 * 60 * 1000,
      powerUpsEnabled: false,
      specialAbilities: false,
      respawnEnabled: true,
    },
    [GameMode.POWER_UP_MADNESS]: {
      name: 'Power-up Madness',
      description: 'Chaos with frequent power-ups and special abilities',
      timeLimit: 3 * 60 * 1000,
      powerUpsEnabled: true,
      specialAbilities: true,
      powerUpSpawnRate: 8000,
    },
    [GameMode.CHAOS]: {
      name: 'Chaos Mode',
      description: 'Random events, power-ups, and unpredictable gameplay',
      timeLimit: 5 * 60 * 1000,
      powerUpsEnabled: true,
      specialAbilities: true,
      randomEvents: true,
      randomEventsInterval: 10000,
    },
  },

  // 🎨 Visual Effects
  EFFECTS: {
    PARTICLE_COUNT: 20,
    TRAIL_LENGTH: 10,
    IMPACT_FLASH_DURATION: 200,
    POWER_UP_GLOW_INTENSITY: 2,
  },

  // 🔊 Audio Configuration
  AUDIO: {
    MASTER_VOLUME: 0.7,
    SFX_VOLUME: 0.8,
    MUSIC_VOLUME: 0.5,
    VOICE_VOLUME: 0.9,
  },

  // 🎯 Advanced Mechanics
  ADVANCED: {
    BOUNCE_DAMAGE_MULTIPLIER: 0.8, // Damage reduction per bounce
    CATCH_WINDOW_MULTIPLIER: 1.2,   // Easier catching when close
    TEAM_BALANCE_THRESHOLD: 2,      // Max team size difference
    STREAK_BONUS_MULTIPLIER: 1.5,   // Score multiplier for kill streaks
  },
};

// 🎮 Power-up Effects Configuration
export const POWER_UP_CONFIG = {
  [PowerUpType.SPEED_BOOST]: {
    name: 'Speed Boost',
    description: 'Move 50% faster for a limited time',
    icon: '⚡',
    color: '#FFD700',
    effect: {
      speedMultiplier: 1.5,
      duration: GameConfig.POWER_UP_DURATION_MS,
    },
  },
  [PowerUpType.INVISIBILITY]: {
    name: 'Invisibility',
    description: 'Become invisible to opponents',
    icon: '👻',
    color: '#8A2BE2',
    effect: {
      opacity: 0.3,
      duration: GameConfig.POWER_UP_DURATION_MS,
    },
  },
  [PowerUpType.MULTI_THROW]: {
    name: 'Multi-Throw',
    description: 'Throw multiple dodgeballs at once',
    icon: '🎯',
    color: '#FF4500',
    effect: {
      throwCount: 3,
      duration: GameConfig.POWER_UP_DURATION_MS,
    },
  },
  [PowerUpType.SHIELD]: {
    name: 'Shield',
    description: 'Protect yourself from one elimination',
    icon: '🛡️',
    color: '#00CED1',
    effect: {
      shieldAmount: 100,
      duration: -1, // Permanent until used
    },
  },
  [PowerUpType.TELEPORT]: {
    name: 'Teleport',
    description: 'Instantly teleport to a safe location',
    icon: '✨',
    color: '#9932CC',
    effect: {
      range: 15,
      duration: 100, // Instant effect
    },
  },
  [PowerUpType.FREEZE]: {
    name: 'Freeze Ray',
    description: 'Freeze an opponent in place',
    icon: '❄️',
    color: '#00BFFF',
    effect: {
      freezeDuration: 3000,
      range: 12,
      duration: 100, // Instant effect
    },
  },
  [PowerUpType.MAGNET]: {
    name: 'Dodgeball Magnet',
    description: 'Nearby dodgeballs are attracted to you',
    icon: '🧲',
    color: '#DC143C',
    effect: {
      range: 20,
      strength: 2,
      duration: GameConfig.POWER_UP_DURATION_MS,
    },
  },
  [PowerUpType.TIME_SLOW]: {
    name: 'Time Slow',
    description: 'Slow down time for everyone except you',
    icon: '⏰',
    color: '#32CD32',
    effect: {
      timeScale: 0.5,
      duration: 5000,
    },
  },
};

// 🏆 Achievement Configuration
export const ACHIEVEMENT_CONFIG = {
  [AchievementType.FIRST_BLOOD]: {
    name: 'First Blood',
    description: 'Get the first elimination of the match',
    icon: '🩸',
    points: 50,
  },
  [AchievementType.DOUBLE_KILL]: {
    name: 'Double Kill',
    description: 'Eliminate two players within 5 seconds',
    icon: '⚡',
    points: 100,
  },
  [AchievementType.TRIPLE_KILL]: {
    name: 'Triple Kill',
    description: 'Eliminate three players within 10 seconds',
    icon: '🔥',
    points: 200,
  },
  [AchievementType.SURVIVOR]: {
    name: 'Survivor',
    description: 'Survive an entire round without being eliminated',
    icon: '🏆',
    points: 150,
  },
  [AchievementType.TEAM_PLAYER]: {
    name: 'Team Player',
    description: 'Help your team win 5 matches',
    icon: '🤝',
    points: 300,
  },
  [AchievementType.CATCH_MASTER]: {
    name: 'Catch Master',
    description: 'Catch 10 dodgeballs thrown by opponents',
    icon: '🎣',
    points: 125,
  },
  [AchievementType.POWER_UP_COLLECTOR]: {
    name: 'Power-up Collector',
    description: 'Collect 20 power-ups in a single match',
    icon: '💎',
    points: 175,
  },
};

// 🎤 Voice Chat Configuration
export const VOICE_CHAT_CONFIG = {
  MAX_VOICE_DISTANCE: 50,        // Maximum distance for voice chat to be heard
  TEAM_VOICE_DISTANCE: 100,      // Distance for team voice chat
  GLOBAL_VOICE_DISTANCE: 200,    // Distance for global voice chat
  VOICE_FADE_START: 20,         // Distance where voice starts to fade
  TEAM_VOICE_FADE_START: 50,    // Distance where team voice starts to fade
  VOICE_VOLUME_NEAR: 1.0,       // Volume when close to speaker
  VOICE_VOLUME_FAR: 0.1,        // Minimum volume when far from speaker
  VOICE_CHAT_COOLDOWN_MS: 100,  // Cooldown between voice messages
  MAX_VOICE_DURATION_MS: 30000, // Maximum duration of a voice message
};