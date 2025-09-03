/**
 * 🏆 Tournament Manager
 *
 * Handles bracket-style tournaments with multiple rounds, seeding,
 * progression, and competitive matchmaking.
 */

import {
  World,
  Player,
} from 'hytopia';

import {
  GameMode,
  GameConfig,
} from './GameConfig.ts';
import GameManager from './GameManager.ts';
import AchievementSystem from './AchievementSystem.ts';

export enum TournamentType {
  SINGLE_ELIMINATION = 'single_elimination',
  DOUBLE_ELIMINATION = 'double_elimination',
  ROUND_ROBIN = 'round_robin',
  SWISS_SYSTEM = 'swiss_system',
}

export enum TournamentStatus {
  WAITING_FOR_PLAYERS = 'waiting_for_players',
  REGISTRATION_OPEN = 'registration_open',
  REGISTRATION_CLOSED = 'registration_closed',
  IN_PROGRESS = 'in_progress',
  ROUND_IN_PROGRESS = 'round_in_progress',
  BETWEEN_ROUNDS = 'between_rounds',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

export enum TournamentRound {
  ROUND_OF_32 = 'round_of_32',
  ROUND_OF_16 = 'round_of_16',
  QUARTER_FINALS = 'quarter_finals',
  SEMI_FINALS = 'semi_finals',
  FINALS = 'finals',
  THIRD_PLACE = 'third_place',
}

interface TournamentPlayer {
  player: Player;
  seed: number;
  wins: number;
  losses: number;
  points: number;
  eliminated: boolean;
  currentMatchId?: string;
  teamId?: string;
}

interface TournamentMatch {
  id: string;
  round: TournamentRound;
  player1: TournamentPlayer;
  player2: TournamentPlayer;
  winner?: TournamentPlayer;
  loser?: TournamentPlayer;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  gameManager?: GameManager;
  startTime?: number;
  endTime?: number;
  score?: { player1: number; player2: number };
}

interface TournamentBracket {
  matches: TournamentMatch[];
  currentRound: TournamentRound;
  totalRounds: number;
  playersPerTeam?: number; // For team tournaments
}

export default class TournamentManager {
  private static _instance: TournamentManager;
  private _world: World | undefined;
  private _currentTournament: Tournament | undefined;
  private _tournamentHistory: Tournament[] = [];

  public static get instance(): TournamentManager {
    if (!this._instance) {
      this._instance = new TournamentManager();
    }
    return this._instance;
  }

  private constructor() {}

  public initialize(world: World): void {
    this._world = world;
    console.log('🏆 Tournament Manager initialized');
  }

  // Create a new tournament
  public createTournament(
    name: string,
    type: TournamentType,
    maxPlayers: number = 16,
    playersPerTeam: number = 1,
    entryFee: number = 0
  ): Tournament {
    if (!this._world) throw new Error('Tournament Manager not initialized');

    const tournament: Tournament = {
      id: this.generateTournamentId(),
      name,
      type,
      maxPlayers,
      playersPerTeam,
      entryFee,
      status: TournamentStatus.WAITING_FOR_PLAYERS,
      players: [],
      bracket: {
        matches: [],
        currentRound: TournamentRound.ROUND_OF_32,
        totalRounds: 5,
        playersPerTeam,
      },
      createdAt: Date.now(),
      settings: {
        gameMode: GameMode.CLASSIC,
        timeLimit: 5 * 60 * 1000, // 5 minutes per match
        powerUpsEnabled: true,
        specialAbilities: false,
        bestOf: 1,
      },
      prizes: this.calculatePrizes(maxPlayers, entryFee),
    };

    this._currentTournament = tournament;
    console.log(`🏆 Created tournament: ${name} (${type}) with max ${maxPlayers} players`);

    return tournament;
  }

  // Register a player for the tournament
  public registerPlayer(player: Player, teamName?: string): boolean {
    if (!this._currentTournament) {
      this.sendPlayerMessage(player, '❌ No active tournament available for registration', 'FF0000');
      return false;
    }

    if (this._currentTournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      this.sendPlayerMessage(player, '❌ Tournament registration is not open', 'FF0000');
      return false;
    }

    if (this._currentTournament.players.length >= this._currentTournament.maxPlayers) {
      this.sendPlayerMessage(player, '❌ Tournament is full', 'FF0000');
      return false;
    }

    // Check if player is already registered
    if (this._currentTournament.players.some(p => p.player.id === player.id)) {
      this.sendPlayerMessage(player, '❌ You are already registered for this tournament', 'FFFF00');
      return false;
    }

    const tournamentPlayer: TournamentPlayer = {
      player,
      seed: 0, // Will be assigned during seeding
      wins: 0,
      losses: 0,
      points: 0,
      eliminated: false,
      teamId: teamName,
    };

    this._currentTournament.players.push(tournamentPlayer);

    this.sendPlayerMessage(
      player,
      `✅ Successfully registered for "${this._currentTournament.name}" tournament!`,
      '00FF00'
    );

    console.log(`👤 ${player.username} registered for tournament ${this._currentTournament.name}`);

    // Check if we have enough players to start
    if (this._currentTournament.players.length >= Math.max(4, this._currentTournament.maxPlayers * 0.5)) {
      this.checkTournamentStart();
    }

    return true;
  }

  // Start tournament registration
  public openRegistration(): boolean {
    if (!this._currentTournament) {
      console.error('❌ No tournament to open registration for');
      return false;
    }

    this._currentTournament.status = TournamentStatus.REGISTRATION_OPEN;
    this.broadcastTournamentMessage(
      `🎯 Registration is now OPEN for "${this._currentTournament.name}"!`,
      '00FF00'
    );
    this.broadcastTournamentMessage(
      `📋 Entry Fee: ${this._currentTournament.entryFee} | Max Players: ${this._currentTournament.maxPlayers}`,
      'FFFF00'
    );
    this.broadcastTournamentMessage(
      '💬 Use /register to join the tournament!',
      'FFFF00'
    );

    console.log(`🎯 Tournament registration opened: ${this._currentTournament.name}`);
    return true;
  }

  // Close tournament registration and start the tournament
  public closeRegistration(): boolean {
    if (!this._currentTournament) {
      console.error('❌ No tournament to close registration for');
      return false;
    }

    if (this._currentTournament.players.length < 4) {
      this.broadcastTournamentMessage(
        '❌ Tournament cancelled - insufficient players (minimum 4 required)',
        'FF0000'
      );
      this.cancelTournament();
      return false;
    }

    this._currentTournament.status = TournamentStatus.REGISTRATION_CLOSED;

    this.broadcastTournamentMessage(
      `🔒 Registration CLOSED for "${this._currentTournament.name}"`,
      'FFFF00'
    );
    this.broadcastTournamentMessage(
      `👥 ${this._currentTournament.players.length} players registered`,
      '00FF00'
    );

    // Start the tournament
    this.startTournament();

    return true;
  }

  // Start the tournament
  private startTournament(): void {
    if (!this._currentTournament) return;

    this._currentTournament.status = TournamentStatus.IN_PROGRESS;
    this._currentTournament.startedAt = Date.now();

    // Seed players
    this.seedPlayers();

    // Generate bracket
    this.generateBracket();

    this.broadcastTournamentMessage(
      `🏆 Tournament "${this._currentTournament.name}" has begun!`,
      'FFD700'
    );
    this.broadcastTournamentMessage(
      `🎯 First round matches are being prepared...`,
      '00FF00'
    );

    // Start first round
    this.startRound(TournamentRound.ROUND_OF_32);

    console.log(`🏆 Tournament started: ${this._currentTournament.name}`);
  }

  // Seed players based on their performance
  private seedPlayers(): void {
    if (!this._currentTournament) return;

    // Sort players by their tournament rating (could be based on wins, achievements, etc.)
    this._currentTournament.players.sort((a, b) => {
      // For now, sort by random seeding (could be improved with rating system)
      return Math.random() - 0.5;
    });

    // Assign seeds
    this._currentTournament.players.forEach((player, index) => {
      player.seed = index + 1;
    });

    console.log(`🎯 Players seeded for tournament`);
  }

  // Generate tournament bracket
  private generateBracket(): void {
    if (!this._currentTournament) return;

    const players = this._currentTournament.players;
    const bracket = this._currentTournament.bracket;

    // Clear existing matches
    bracket.matches = [];

    // Generate matches for first round
    for (let i = 0; i < players.length; i += 2) {
      if (i + 1 < players.length) {
        const match: TournamentMatch = {
          id: this.generateMatchId(),
          round: TournamentRound.ROUND_OF_32,
          player1: players[i],
          player2: players[i + 1],
          status: 'pending',
        };

        bracket.matches.push(match);
      }
    }

    console.log(`📋 Generated bracket with ${bracket.matches.length} first-round matches`);
  }

  // Start a tournament round
  private startRound(round: TournamentRound): void {
    if (!this._currentTournament) return;

    const bracket = this._currentTournament.bracket;
    bracket.currentRound = round;

    this.broadcastTournamentMessage(
      `🎯 Round ${this.getRoundDisplayName(round)} begins now!`,
      'FFD700'
    );

    // Start all matches in this round
    const roundMatches = bracket.matches.filter(match => match.round === round);

    roundMatches.forEach((match, index) => {
      // Stagger match starts to avoid server overload
      setTimeout(() => {
        this.startMatch(match);
      }, index * 2000); // 2 second delay between matches
    });

    console.log(`🎯 Started round ${round} with ${roundMatches.length} matches`);
  }

  // Start a specific match
  private startMatch(match: TournamentMatch): void {
    if (!this._world || !this._currentTournament) return;

    match.status = 'in_progress';
    match.startTime = Date.now();

    // Create a new game manager for this match
    const gameManager = new GameManager();

    // Set up the match with tournament settings
    gameManager.setupGame(this._world);

    // Add players to the match
    gameManager.handlePlayerJoin(match.player1.player);
    gameManager.handlePlayerJoin(match.player2.player);

    match.gameManager = gameManager;

    this.broadcastMatchMessage(
      match,
      `🏐 Match started: ${match.player1.player.username} vs ${match.player2.player.username}`,
      '00FF00'
    );

    console.log(`🏐 Started match: ${match.player1.player.username} vs ${match.player2.player.username}`);
  }

  // Handle match completion
  public handleMatchCompletion(match: TournamentMatch, winner: TournamentPlayer, loser: TournamentPlayer): void {
    if (!this._currentTournament) return;

    match.status = 'completed';
    match.endTime = Date.now();
    match.winner = winner;
    match.loser = loser;

    // Update player statistics
    winner.wins++;
    winner.points += 3; // 3 points for a win
    loser.losses++;
    loser.points += 1; // 1 point for participation
    loser.eliminated = true;

    // Record for achievements
    AchievementSystem.instance.recordElimination(winner.player, loser.player.id);

    // Announce result
    this.broadcastMatchMessage(
      match,
      `🏆 ${winner.player.username} defeats ${loser.player.username}!`,
      'FFD700'
    );

    // Check if round is complete
    this.checkRoundCompletion();

    console.log(`🏆 Match completed: ${winner.player.username} defeats ${loser.player.username}`);
  }

  // Check if current round is complete
  private checkRoundCompletion(): void {
    if (!this._currentTournament) return;

    const bracket = this._currentTournament.bracket;
    const currentRoundMatches = bracket.matches.filter(
      match => match.round === bracket.currentRound && match.status !== 'completed'
    );

    // If no matches are pending/in progress, round is complete
    if (currentRoundMatches.length === 0) {
      this.completeRound();
    }
  }

  // Complete current round and advance to next
  private completeRound(): void {
    if (!this._currentTournament) return;

    const bracket = this._currentTournament.bracket;
    const currentRound = bracket.currentRound;

    this.broadcastTournamentMessage(
      `🎉 Round ${this.getRoundDisplayName(currentRound)} completed!`,
      'FFD700'
    );

    // Get winners of current round
    const winners = bracket.matches
      .filter(match => match.round === currentRound && match.winner)
      .map(match => match.winner!);

    if (winners.length <= 1) {
      // Tournament finished!
      this.completeTournament(winners[0]);
      return;
    }

    // Generate next round matches
    this.generateNextRound(winners);

    console.log(`🎉 Round ${currentRound} completed, advancing to next round`);
  }

  // Generate matches for next round
  private generateNextRound(winners: TournamentPlayer[]): void {
    if (!this._currentTournament) return;

    const bracket = this._currentTournament.bracket;
    const nextRound = this.getNextRound(bracket.currentRound);

    if (!nextRound) return;

    bracket.currentRound = nextRound;

    // Create matches for next round
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        const match: TournamentMatch = {
          id: this.generateMatchId(),
          round: nextRound,
          player1: winners[i],
          player2: winners[i + 1],
          status: 'pending',
        };

        bracket.matches.push(match);
      }
    }

    // Start next round after a short delay
    setTimeout(() => {
      this.startRound(nextRound);
    }, 10000); // 10 second break between rounds

    console.log(`📋 Generated ${winners.length / 2} matches for ${nextRound}`);
  }

  // Complete tournament
  private completeTournament(winner: TournamentPlayer): void {
    if (!this._currentTournament) return;

    this._currentTournament.status = TournamentStatus.FINISHED;
    this._currentTournament.finishedAt = Date.now();
    this._currentTournament.winner = winner;

    this.broadcastTournamentMessage(
      `🏆 TOURNAMENT COMPLETE! 🏆`,
      'FFD700'
    );
    this.broadcastTournamentMessage(
      `👑 ${winner.player.username} is the champion of "${this._currentTournament.name}"!`,
      'FFD700'
    );

    // Award prizes
    this.awardPrizes();

    // Save to history
    this._tournamentHistory.push(this._currentTournament);

    // Reset for next tournament
    this._currentTournament = undefined;

    console.log(`🏆 Tournament completed: ${winner.player.username} is the champion`);
  }

  // Award tournament prizes
  private awardPrizes(): void {
    if (!this._currentTournament) return;

    const prizes = this._currentTournament.prizes;

    // Award to top players
    const sortedPlayers = this._currentTournament.players
      .sort((a, b) => b.points - a.points);

    if (sortedPlayers.length >= 1 && prizes.first) {
      this.awardPrize(sortedPlayers[0], prizes.first, 1);
    }
    if (sortedPlayers.length >= 2 && prizes.second) {
      this.awardPrize(sortedPlayers[1], prizes.second, 2);
    }
    if (sortedPlayers.length >= 3 && prizes.third) {
      this.awardPrize(sortedPlayers[2], prizes.third, 3);
    }
  }

  // Award prize to player
  private awardPrize(player: TournamentPlayer, prize: string, position: number): void {
    this.sendPlayerMessage(
      player.player,
      `🎉 Congratulations! You finished ${position}${this.getOrdinalSuffix(position)} place and won: ${prize}`,
      'FFD700'
    );

    console.log(`🎉 Awarded ${prize} to ${player.player.username} (${position} place)`);
  }

  // Cancel tournament
  public cancelTournament(): void {
    if (!this._currentTournament) return;

    this._currentTournament.status = TournamentStatus.CANCELLED;

    this.broadcastTournamentMessage(
      `❌ Tournament "${this._currentTournament.name}" has been cancelled`,
      'FF0000'
    );

    // Refund entry fees (if any)
    if (this._currentTournament.entryFee > 0) {
      this._currentTournament.players.forEach(player => {
        this.sendPlayerMessage(
          player.player,
          `💰 Your entry fee of ${this._currentTournament!.entryFee} has been refunded`,
          '00FF00'
        );
      });
    }

    this._currentTournament = undefined;
    console.log('❌ Tournament cancelled');
  }

  // Helper methods
  private generateTournamentId(): string {
    return `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMatchId(): string {
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRoundDisplayName(round: TournamentRound): string {
    const names = {
      [TournamentRound.ROUND_OF_32]: 'Round of 32',
      [TournamentRound.ROUND_OF_16]: 'Round of 16',
      [TournamentRound.QUARTER_FINALS]: 'Quarter Finals',
      [TournamentRound.SEMI_FINALS]: 'Semi Finals',
      [TournamentRound.FINALS]: 'Finals',
      [TournamentRound.THIRD_PLACE]: 'Third Place',
    };
    return names[round] || round;
  }

  private getNextRound(currentRound: TournamentRound): TournamentRound | null {
    const progression = {
      [TournamentRound.ROUND_OF_32]: TournamentRound.ROUND_OF_16,
      [TournamentRound.ROUND_OF_16]: TournamentRound.QUARTER_FINALS,
      [TournamentRound.QUARTER_FINALS]: TournamentRound.SEMI_FINALS,
      [TournamentRound.SEMI_FINALS]: TournamentRound.FINALS,
      [TournamentRound.FINALS]: null,
      [TournamentRound.THIRD_PLACE]: null,
    };
    return progression[currentRound] || null;
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  }

  private calculatePrizes(maxPlayers: number, entryFee: number): TournamentPrizes {
    const totalPrizePool = maxPlayers * entryFee;
    return {
      first: `${Math.floor(totalPrizePool * 0.5)} credits`,
      second: `${Math.floor(totalPrizePool * 0.3)} credits`,
      third: `${Math.floor(totalPrizePool * 0.2)} credits`,
    };
  }

  private checkTournamentStart(): void {
    if (!this._currentTournament) return;

    // Auto-start if we have minimum players or after a delay
    const minPlayers = Math.max(4, this._currentTournament.maxPlayers * 0.75);

    if (this._currentTournament.players.length >= minPlayers) {
      setTimeout(() => {
        if (this._currentTournament?.status === TournamentStatus.REGISTRATION_OPEN) {
          console.log(`🎯 Auto-starting tournament with ${this._currentTournament.players.length} players`);
          this.closeRegistration();
        }
      }, 30000); // 30 second delay
    }
  }

  // Communication methods
  private sendPlayerMessage(player: Player, message: string, color: string = 'FFFFFF'): void {
    if (this._world) {
      this._world.chatManager.sendPlayerMessage(player, message, color);
    }
  }

  private broadcastTournamentMessage(message: string, color: string = 'FFFFFF'): void {
    if (this._world) {
      this._world.chatManager.sendBroadcastMessage(message, color);
    }
  }

  private broadcastMatchMessage(match: TournamentMatch, message: string, color: string = 'FFFFFF'): void {
    if (this._world) {
      // Send to players in the match
      this._world.chatManager.sendPlayerMessage(match.player1.player, message, color);
      this._world.chatManager.sendPlayerMessage(match.player2.player, message, color);
    }
  }

  // Getters
  public get currentTournament(): Tournament | undefined {
    return this._currentTournament;
  }

  public get tournamentHistory(): Tournament[] {
    return this._tournamentHistory;
  }

  public getTournamentStats(): any {
    if (!this._currentTournament) return null;

    const activeMatches = this._currentTournament.bracket.matches.filter(
      match => match.status === 'in_progress'
    ).length;

    const completedMatches = this._currentTournament.bracket.matches.filter(
      match => match.status === 'completed'
    ).length;

    return {
      name: this._currentTournament.name,
      status: this._currentTournament.status,
      players: this._currentTournament.players.length,
      maxPlayers: this._currentTournament.maxPlayers,
      activeMatches,
      completedMatches,
      currentRound: this._currentTournament.bracket.currentRound,
      winner: this._currentTournament.winner?.player.username,
    };
  }
}

// Type definitions
interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  maxPlayers: number;
  playersPerTeam: number;
  entryFee: number;
  status: TournamentStatus;
  players: TournamentPlayer[];
  bracket: TournamentBracket;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  winner?: TournamentPlayer;
  settings: TournamentSettings;
  prizes: TournamentPrizes;
}

interface TournamentSettings {
  gameMode: GameMode;
  timeLimit: number;
  powerUpsEnabled: boolean;
  specialAbilities: boolean;
  bestOf: number;
}

interface TournamentPrizes {
  first?: string;
  second?: string;
  third?: string;
}
