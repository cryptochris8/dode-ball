/**
 * 🚀 Ultimate Dodgeball Arena
 *
 * A fast-paced, action-packed multiplayer dodgeball game built with the Hytopia SDK.
 * Features multiple game modes, power-ups, and intense team-based combat!
 */

import {
  startServer,
  PlayerEvent,
  WorldEvent,
} from 'hytopia';

import GameManager from './src/GameManager.ts';
import dodgeballMap from './assets/maps/map.json';

// Mobile user tracking
const mobileUsers = new Set();

// Chat command handler
function handleChatCommand(world: any, player: any, message: string): void {
  const parts = message.split(' ');
  const command = parts[0]?.toLowerCase() || '';

  switch (command) {
    // Tournament commands
    case '/tournament':
    case '/tourney':
      handleTournamentCommand(world, player, parts);
      break;

    // Spectator commands
    case '/spectate':
    case '/spec':
      handleSpectatorCommand(world, player, parts);
      break;

    // AI commands
    case '/ai':
    case '/bot':
      handleAICommand(world, player, parts);
      break;

    // Statistics commands
    case '/stats':
    case '/statistics':
      handleStatsCommand(world, player, parts);
      break;

    // Seasonal events commands
    case '/event':
    case '/events':
      handleEventCommand(world, player, parts);
      break;

    // Game mode commands
    case '/mode':
    case '/gamemode':
      handleModeCommand(world, player, parts);
      break;

    // Voice chat commands
    case '/voice':
    case '/vc':
      handleVoiceCommand(world, player, parts);
      break;

    // Help command
    case '/help':
    case '/commands':
      handleHelpCommand(world, player, parts);
      break;

    // Admin commands (would require admin check)
    case '/admin':
      handleAdminCommand(world, player, parts);
      break;

    default:
      // Not a command, let it pass through as normal chat
      break;
  }
}

function handleTournamentCommand(world: any, player: any, parts: string[]): void {
  const subCommand = parts[1]?.toLowerCase();

  switch (subCommand) {
    case 'create':
      const name = parts.length > 2 ? parts.slice(2).join(' ').trim() : `${player.username}'s Tournament`;
      const finalName = name || `${player.username}'s Tournament`;
      const maxPlayers = parts.length > 2 && parts[parts.length - 1] ? parseInt(parts[parts.length - 1]!) || 16 : 16;
      if (GameManager.instance.createTournament(finalName, maxPlayers)) {
        world.chatManager.sendPlayerMessage(
          player,
          `🏆 Tournament "${finalName}" created successfully!`,
          'FFD700'
        );
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          '❌ Failed to create tournament',
          'FF0000'
        );
      }
      break;

    case 'join':
    case 'register':
      if (GameManager.instance.registerPlayerForTournament(player)) {
        world.chatManager.sendPlayerMessage(
          player,
          '✅ Successfully registered for tournament!',
          '00FF00'
        );
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          '❌ Failed to register for tournament',
          'FF0000'
        );
      }
      break;

    case 'start':
      if (GameManager.instance.startTournamentRegistration()) {
        world.chatManager.sendBroadcastMessage(
          '🎯 Tournament registration has opened!',
          '00FF00'
        );
      }
      break;

    case 'stop':
    case 'close':
      if (GameManager.instance.stopTournamentRegistration()) {
        world.chatManager.sendBroadcastMessage(
          '🔒 Tournament registration has closed!',
          'FFFF00'
        );
      }
      break;

    case 'status':
      const tournamentStats = GameManager.instance.getTournamentStats();
      if (tournamentStats) {
        world.chatManager.sendPlayerMessage(
          player,
          `🏆 ${tournamentStats.name} - ${tournamentStats.status}`,
          'FFD700'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `👥 ${tournamentStats.players}/${tournamentStats.maxPlayers} players`,
          '00FF00'
        );
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          '❌ No active tournament',
          'FF0000'
        );
      }
      break;

    default:
      world.chatManager.sendPlayerMessage(
        player,
        '🏆 Tournament Commands:',
        'FFD700'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/tournament create [name] - Create tournament',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/tournament join - Register for tournament',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/tournament start/stop - Open/close registration',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/tournament status - View tournament info',
        'FFFF00'
      );
  }
}

function handleSpectatorCommand(world: any, player: any, parts: string[]): void {
  const subCommand = parts[1]?.toLowerCase();

  switch (subCommand) {
    case 'join':
    case 'start':
      if (GameManager.instance.enableSpectatorMode(player)) {
        world.chatManager.sendPlayerMessage(
          player,
          '👁️ Spectator mode enabled!',
          '00FF00'
        );
      }
      break;

    case 'leave':
    case 'exit':
      if (GameManager.instance.disableSpectatorMode(player)) {
        world.chatManager.sendPlayerMessage(
          player,
          '👋 Exited spectator mode',
          'FF0000'
        );
      }
      break;

    case 'follow':
      const targetName = parts[2];
      if (targetName) {
        // Find target player (simplified)
        const targetPlayer = { id: 'dummy', username: targetName }; // Would need proper lookup
        if (GameManager.instance.setSpectatorFollowTarget(player, targetPlayer as any)) {
          world.chatManager.sendPlayerMessage(
            player,
            `👤 Now following ${targetName}`,
            '9932CC'
          );
        }
      }
      break;

    case 'mode':
      const mode = parts[2]?.toLowerCase();
      if (mode && GameManager.instance.changeSpectatorCameraMode(player, mode as any)) {
        world.chatManager.sendPlayerMessage(
          player,
          `📷 Camera mode: ${mode}`,
          '00CED1'
        );
      }
      break;

    default:
      world.chatManager.sendPlayerMessage(
        player,
        '👁️ Spectator Commands:',
        '00CED1'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/spectate join - Enter spectator mode',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/spectate follow [player] - Follow a player',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/spectate mode [free/follow/overview/cinematic] - Change camera mode',
        'FFFF00'
      );
  }
}

function handleAICommand(world: any, player: any, parts: string[]): void {
  const subCommand = parts[1]?.toLowerCase();

  switch (subCommand) {
    case 'add':
      const difficulty = parts[2] || 'medium';
      const behavior = parts[3] || 'balanced';
      const team = parts[4] === 'blue' ? 'blue' : 'red';
      const aiName = `AI_${Date.now().toString().slice(-4)}`;

      if (GameManager.instance.createAIOpponent(aiName, team as any, difficulty, behavior)) {
        world.chatManager.sendPlayerMessage(
          player,
          `🤖 Added AI opponent: ${aiName} (${difficulty}, ${behavior})`,
          '00FF00'
        );
      }
      break;

    case 'fill':
      const targetCount = parts[2] ? parseInt(parts[2]) || 8 : 8;
      const added = GameManager.instance.fillWithAIOpponents(targetCount);
      world.chatManager.sendPlayerMessage(
        player,
        `🤖 Added ${added} AI opponents to reach ${targetCount} total players`,
        '00FF00'
      );
      break;

    case 'remove':
      const aiId = parts[2];
      if (aiId && GameManager.instance.removeAIOpponent(aiId)) {
        world.chatManager.sendPlayerMessage(
          player,
          `🤖 Removed AI opponent`,
          'FF0000'
        );
      }
      break;

    case 'stats':
      const aiStats = GameManager.instance.getAIStats();
      world.chatManager.sendPlayerMessage(
        player,
        `🤖 AI Stats: ${aiStats.totalAI} active, ${aiStats.averageSkill.toFixed(1)} avg skill`,
        '00CED1'
      );
      break;

    default:
      world.chatManager.sendPlayerMessage(
        player,
        '🤖 AI Commands:',
        '00CED1'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/ai add [difficulty] [behavior] [team] - Add AI opponent',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/ai fill [count] - Fill with AI to reach total count',
        'FFFF00'
      );
  }
}

function handleStatsCommand(world: any, player: any, parts: string[]): void {
  const subCommand = parts[1]?.toLowerCase();

  switch (subCommand) {
    case 'me':
    case 'player':
      const playerStats = GameManager.instance.getPlayerStats(player.id);
      if (playerStats) {
        world.chatManager.sendPlayerMessage(
          player,
          `📊 Your Stats: ${playerStats.gamesPlayed} games, ${playerStats.winRate.toFixed(1)}% WR`,
          '00CED1'
        );
      }
      break;

    case 'leaderboard':
    case 'top':
      const limit = parts[2] ? parseInt(parts[2]) || 5 : 5;
      const leaderboard = GameManager.instance.getLeaderboard(limit);
      world.chatManager.sendPlayerMessage(
        player,
        `🏆 Top ${limit} Players:`,
        'FFD700'
      );
      leaderboard.forEach((entry, index) => {
        world.chatManager.sendPlayerMessage(
          player,
          `${index + 1}. ${entry.username} - ${entry.skillRating} SR`,
          'FFFF00'
        );
      });
      break;

    case 'server':
      const serverStats = GameManager.instance.getServerStats();
      world.chatManager.sendPlayerMessage(
        player,
        `🖥️ Server: ${serverStats.totalPlayers} players, ${serverStats.totalGamesPlayed} games`,
        '00CED1'
      );
      break;

    case 'game':
    case 'match':
      const gameStats = GameManager.instance.getGameStats();
      world.chatManager.sendPlayerMessage(
        player,
        `🎮 Game: ${gameStats.alivePlayers}/${gameStats.totalPlayers} alive`,
        '00CED1'
      );
      break;

    default:
      world.chatManager.sendPlayerMessage(
        player,
        '📊 Stats Commands:',
        '00CED1'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/stats me - View your personal stats',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/stats leaderboard [count] - View top players',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/stats server - View server statistics',
        'FFFF00'
      );
  }
}

function handleEventCommand(world: any, player: any, parts: string[]): void {
  const subCommand = parts[1]?.toLowerCase();

  switch (subCommand) {
    case 'list':
      const activeEvents = GameManager.instance.getActiveEvents();
      world.chatManager.sendPlayerMessage(
        player,
        `🎉 Active Events (${activeEvents.length}):`,
        'FFD700'
      );
      activeEvents.forEach(event => {
        world.chatManager.sendPlayerMessage(
          player,
          `• ${event.name}: ${event.description}`,
          'FFFF00'
        );
      });
      break;

    case 'join':
      const eventId = parts[2];
      if (eventId && GameManager.instance.participateInEvent(player, eventId)) {
        world.chatManager.sendPlayerMessage(
          player,
          '🎯 Successfully joined event!',
          '00FF00'
        );
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          '❌ Failed to join event',
          'FF0000'
        );
      }
      break;

    case 'season':
      const season = GameManager.instance.getCurrentSeason();
      const theme = GameManager.instance.getSeasonalTheme();
      world.chatManager.sendPlayerMessage(
        player,
        `🌸 Current Season: ${season}`,
        'FFD700'
      );
      if (theme) {
        world.chatManager.sendPlayerMessage(
          player,
          `🎨 Theme: ${theme.name} - ${theme.description}`,
          '00CED1'
        );
      }
      break;

    default:
      world.chatManager.sendPlayerMessage(
        player,
        '🎉 Event Commands:',
        'FFD700'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/event list - View active events',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/event join [event_id] - Join an event',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/event season - View current season info',
        'FFFF00'
      );
  }
}

function handleModeCommand(world: any, player: any, parts: string[]): void {
  const mode = parts[1]?.toLowerCase();

  if (!mode) {
    world.chatManager.sendPlayerMessage(
      player,
      '🎮 Available Game Modes:',
      '00CED1'
    );
    world.chatManager.sendPlayerMessage(
      player,
      '• Classic - Traditional dodgeball',
      'FFFF00'
    );
    world.chatManager.sendPlayerMessage(
      player,
      '• Survival - Last team standing',
      'FFFF00'
    );
    world.chatManager.sendPlayerMessage(
      player,
      '• Time Attack - Score eliminations quickly',
      'FFFF00'
    );
    world.chatManager.sendPlayerMessage(
      player,
      '• Power-up Madness - Frequent power-ups',
      'FFFF00'
    );
    world.chatManager.sendPlayerMessage(
      player,
      '• Chaos - Random events and unpredictability',
      'FFFF00'
    );
    return;
  }

  // Mode switching would be implemented here
  world.chatManager.sendPlayerMessage(
    player,
    `🎮 Game mode switching not yet implemented. Current mode: ${mode}`,
    'FFFF00'
  );
}

function handleHelpCommand(world: any, player: any, parts: string[]): void {
  const category = parts[1]?.toLowerCase();

  switch (category) {
    case 'tournament':
    case 'tourney':
      handleTournamentCommand(world, player, ['/tournament']);
      break;
    case 'spectator':
    case 'spec':
      handleSpectatorCommand(world, player, ['/spectate']);
      break;
    case 'ai':
    case 'bot':
      handleAICommand(world, player, ['/ai']);
      break;
    case 'stats':
      handleStatsCommand(world, player, ['/stats']);
      break;
    case 'event':
      handleEventCommand(world, player, ['/event']);
      break;
    case 'voice':
    case 'vc':
      handleVoiceCommand(world, player, ['/voice']);
      break;
    default:
      world.chatManager.sendPlayerMessage(
        player,
        '🎯 Ultimate Dodgeball Commands:',
        'FFD700'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '🏆 /tournament - Tournament management',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '👁️ /spectate - Spectator mode',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '🤖 /ai - AI opponent management',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '📊 /stats - View statistics',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '🎉 /event - Seasonal events',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '🎤 /voice - Voice chat controls',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '🎮 /mode - Game mode information',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '❓ /help [category] - Get detailed help',
        'FFFF00'
      );

      // Add mobile-specific help if detected
      if (mobileUsers.has(player.id)) {
        world.chatManager.sendPlayerMessage(
          player,
          '📱 Mobile Controls: Use virtual joystick to move, tap buttons to throw/catch/dash',
          '00CED1'
        );
      }
  }
}

function handleAdminCommand(world: any, player: any, parts: string[]): void {
  // This would require admin permission checking
  const subCommand = parts[1]?.toLowerCase();

  switch (subCommand) {
    case 'kick':
      const targetName = parts[2];
      world.chatManager.sendPlayerMessage(
        player,
        `Admin command: kick ${targetName}`,
        'FF0000'
      );
      break;
    case 'ban':
      const banTarget = parts[2];
      world.chatManager.sendPlayerMessage(
        player,
        `Admin command: ban ${banTarget}`,
        'FF0000'
      );
      break;
    case 'restart':
      world.chatManager.sendBroadcastMessage(
        '🔄 Server restarting in 30 seconds...',
        'FFFF00'
      );
      break;
    default:
      world.chatManager.sendPlayerMessage(
        player,
        '🔧 Admin Commands (requires admin privileges):',
        'FF0000'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/admin kick [player] - Kick a player',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/admin ban [player] - Ban a player',
        'FFFF00'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '/admin restart - Restart the server',
        'FFFF00'
      );
  }
}

// Voice command handler
function handleVoiceCommand(world: any, player: any, parts: string[]): void {
  const subCommand = parts[1]?.toLowerCase();

  switch (subCommand) {
    case 'mute':
    case 'm':
      const muted = GameManager.instance.togglePlayerMute(player.id);
      world.chatManager.sendPlayerMessage(
        player,
        `🎤 Voice chat ${muted ? 'muted' : 'unmuted'}`,
        muted ? 'FF0000' : '00FF00'
      );
      break;

    case 'deafen':
    case 'd':
      const deafened = GameManager.instance.togglePlayerDeafen(player.id);
      world.chatManager.sendPlayerMessage(
        player,
        `🔇 Voice chat ${deafened ? 'deafened' : 'undeafened'}`,
        deafened ? 'FF0000' : '00FF00'
      );
      break;

    case 'team':
    case 't':
      const teamSet = GameManager.instance.setPlayerVoiceMode(player.id, 'team');
      world.chatManager.sendPlayerMessage(
        player,
        `🎤 Voice mode set to TEAM`,
        teamSet ? '00FF00' : 'FF0000'
      );
      break;

    case 'global':
    case 'g':
      const globalSet = GameManager.instance.setPlayerVoiceMode(player.id, 'global');
      world.chatManager.sendPlayerMessage(
        player,
        `🎤 Voice mode set to GLOBAL`,
        globalSet ? '00FF00' : 'FF0000'
      );
      break;

    case 'proximity':
    case 'p':
      const proximitySet = GameManager.instance.setPlayerVoiceMode(player.id, 'proximity');
      world.chatManager.sendPlayerMessage(
        player,
        `🎤 Voice mode set to PROXIMITY`,
        proximitySet ? '00FF00' : 'FF0000'
      );
      break;

    case 'off':
    case 'o':
      const offSet = GameManager.instance.setPlayerVoiceMode(player.id, 'off');
      world.chatManager.sendPlayerMessage(
        player,
        `🎤 Voice chat turned OFF`,
        offSet ? '00FF00' : 'FF0000'
      );
      break;

    case 'settings':
    case 's':
      const settings = GameManager.instance.getPlayerVoiceSettings(player.id);
      if (settings) {
        world.chatManager.sendPlayerMessage(
          player,
          `🎤 Voice Settings:`,
          'FFD700'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Mode: ${settings.mode.toUpperCase()}`,
          'FFFFFF'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Volume: ${Math.round(settings.volume * 100)}%`,
          'FFFFFF'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Muted: ${settings.muted ? 'Yes' : 'No'}`,
          settings.muted ? 'FF0000' : '00FF00'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Deafened: ${settings.deafened ? 'Yes' : 'No'}`,
          settings.deafened ? 'FF0000' : '00FF00'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Voice Activity: ${settings.voiceActivityEnabled ? 'Enabled' : 'Disabled'}`,
          settings.voiceActivityEnabled ? '00FF00' : 'FF0000'
        );
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          '❌ Could not retrieve voice settings',
          'FF0000'
        );
      }
      break;

    case 'stats':
      const voiceStats = GameManager.instance.getVoiceStats();
      if (voiceStats) {
        world.chatManager.sendPlayerMessage(
          player,
          `🎤 Voice Chat Stats:`,
          'FFD700'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Active Messages: ${voiceStats.activeMessages}`,
          'FFFFFF'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Total Players: ${voiceStats.totalPlayers}`,
          'FFFFFF'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Voice Entities: ${voiceStats.voiceEntities}`,
          'FFFFFF'
        );
        world.chatManager.sendPlayerMessage(
          player,
          `  Mode Distribution:`,
          'FFFFFF'
        );
        Object.entries(voiceStats.modeDistribution).forEach(([mode, count]) => {
          world.chatManager.sendPlayerMessage(
            player,
            `    ${mode.toUpperCase()}: ${count}`,
            'FFFFFF'
          );
        });
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          '❌ Voice chat not available',
          'FF0000'
        );
      }
      break;

    default:
      world.chatManager.sendPlayerMessage(
        player,
        '🎤 Voice Chat Commands:',
        'FFD700'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice mute|/vc m - Toggle mute',
        'FFFFFF'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice deafen|/vc d - Toggle deafen',
        'FFFFFF'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice team|/vc t - Team voice mode',
        'FFFFFF'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice global|/vc g - Global voice mode',
        'FFFFFF'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice proximity|/vc p - Proximity voice mode',
        'FFFFFF'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice off|/vc o - Turn off voice chat',
        'FFFFFF'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice settings|/vc s - View voice settings',
        'FFFFFF'
      );
      world.chatManager.sendPlayerMessage(
        player,
        '  /voice stats - View voice statistics',
        'FFFFFF'
      );
      break;
  }
}

// Server configuration
const SERVER_CONFIG = {
  maxPlayers: 16,
  gameVersion: '1.0.0',
  features: {
    powerUps: true,
    multipleGameModes: true,
    achievements: true,
    statistics: true,
  },
};

startServer(world => {
  console.log(`🎯 Starting Ultimate Dodgeball Arena v${SERVER_CONFIG.gameVersion}`);
  console.log(`📊 Max players: ${SERVER_CONFIG.maxPlayers}`);
  console.log(`⚡ Features enabled: ${Object.entries(SERVER_CONFIG.features)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => feature)
    .join(', ')}`);

  try {
    // Load the dodgeball arena map
    world.loadMap(dodgeballMap);
    console.log('✅ Map loaded successfully');

    // Configure world settings
    world.setAmbientLightIntensity(1.2);
    world.setDirectionalLightIntensity(4);

    // Set up world physics and collision groups
    world.simulation.setGravity({ x: 0, y: -24, z: 0 });

    // Initialize the game manager
    GameManager.instance.setupGame(world);
    console.log('🎮 Game manager initialized');

    // Handle world events
    world.on('tick', ({ deltaTimeMs }) => {
      GameManager.instance.update(deltaTimeMs);
    });

      // Handle player events
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`👤 Player ${player.username} joined the arena`);

    try {
      GameManager.instance.handlePlayerJoin(player);
      console.log(`✅ Player ${player.username} successfully initialized`);

      // Send welcome message with available commands
      setTimeout(() => {
        world.chatManager.sendPlayerMessage(
          player,
          '🎯 Welcome! Type /help to see all available commands',
          '00FF00'
        );
      }, 3000);

    } catch (error) {
      console.error(`❌ Failed to initialize player ${player.username}:`, error);
      world.chatManager.sendPlayerMessage(
        player,
        'Failed to join game. Please try reconnecting.',
        'FF0000'
      );
    }
  });

      world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`👋 Player ${player.username} left the arena`);
    GameManager.instance.handlePlayerLeave(player);

    // Clean up mobile user tracking
    mobileUsers.delete(player.id);
  });

  // Handle client data (touch input, etc.)
  world.on('player_data', ({ player, data }) => {
    try {
      switch (data.type) {
        case 'touch-input':
          // Handle touch input from mobile devices
          if (data.joystick && data.buttons) {
            // Mark user as mobile when they send touch input
            mobileUsers.add(player.id);
            GameManager.instance.handleTouchInput(player, data.joystick, data.buttons);
          }
          break;
        default:
          console.log(`📦 Unknown data type from ${player.username}:`, data.type);
          break;
      }
    } catch (error) {
      console.error(`❌ Error processing data from ${player.username}:`, error);
    }
  });

  // Handle chat messages for commands
  world.on('chat_message', ({ player, message }) => {
    console.log(`💬 ${player.username}: ${message}`);

    try {
      handleChatCommand(world, player, message);
    } catch (error) {
      console.error(`❌ Error processing chat command from ${player.username}:`, error);
      world.chatManager.sendPlayerMessage(
        player,
        'Command failed. Type /help for available commands.',
        'FF0000'
      );
    }
  });

    console.log('🎯 Ultimate Dodgeball Arena is ready! Waiting for players...');

  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    throw error;
  }
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Ultimate Dodgeball Arena...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminated');
  process.exit(0);
});
