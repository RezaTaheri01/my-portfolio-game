import Phaser from "phaser";
import "./styles/main.css";
import "./objects/register"; // registers entity kinds (must run before any scene spawns)
import { gameConfig } from "./game/config";

new Phaser.Game(gameConfig);