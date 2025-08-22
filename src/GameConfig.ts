/**
 * Game configuration constants for Dodgeball
 */

export const GameConfig = {
  // Game settings
  MIN_PLAYERS_TO_START: 2,
  COUNTDOWN_SECONDS: 5,
  ROUND_TIME_MS: 3 * 60 * 1000, // 3 minutes
  ROUND_END_DELAY_MS: 5000, // 5 seconds

  // Dodgeball settings
  DODGEBALL_COUNT: 6, // Number of balls to spawn
  DODGEBALL_DAMAGE: 100, // Instant elimination
  DODGEBALL_SPEED: 20,
  DODGEBALL_CATCH_WINDOW_MS: 200, // Time window to catch a ball

  // Field boundaries (based on soccer stadium)
  FIELD_CENTER_Z: 0,
  FIELD_MIN_X: -30,
  FIELD_MAX_X: 30,
  FIELD_MIN_Z: -35,
  FIELD_MAX_Z: 35,
};