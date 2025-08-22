/**
 * Dodgeball Game
 * 
 * A multiplayer dodgeball game built with the Hytopia SDK.
 * Players are divided into two teams and must eliminate
 * opponents by hitting them with dodgeballs.
 */

import {
  startServer,
  PlayerEvent,
} from 'hytopia';

import GameManager from './src/GameManager';
import soccerMap from './assets/maps/map.json';

startServer(world => {
  // Load the soccer stadium map
  world.loadMap(soccerMap);

  // Set up lighting for the stadium
  world.setAmbientLightIntensity(1.0);
  world.setDirectionalLightIntensity(3);

  // Initialize the game manager
  GameManager.instance.setupGame(world);

  // Handle player joining
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    GameManager.instance.handlePlayerJoin(player);
  });

  // Handle player leaving
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    GameManager.instance.handlePlayerLeave(player);
  });
});
