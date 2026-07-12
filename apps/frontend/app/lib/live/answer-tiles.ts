import { Circle, Diamond, Square, Triangle, type LucideIcon } from "lucide-react";

/**
 * Colour + shape for each answer slot in the Quiz game, shared by the presenter
 * tiles and the participant buzzer buttons so they always match. Colours reuse
 * the theme `chart-1..4` tokens, so the tiles follow the theme changer. Shapes
 * make the slots distinguishable for colour-blind players.
 */
export interface AnswerTile {
  /** Solid background utility (+ hover) for the tile/button. */
  color: string;
  /** Ring utility used to highlight the correct answer on reveal. */
  ring: string;
  Shape: LucideIcon;
  /** Stable slot name, handy for aria labels / tests. */
  name: string;
}

// Fixed, high-contrast red / blue / yellow / green — deliberately NOT the theme
// colours so the four answer slots are always maximally distinct on presenter
// and phones alike.
export const ANSWER_TILES: readonly AnswerTile[] = [
  { color: "bg-red-500 hover:bg-red-500/90", ring: "ring-red-500", Shape: Triangle, name: "red" },
  { color: "bg-blue-500 hover:bg-blue-500/90", ring: "ring-blue-500", Shape: Diamond, name: "blue" },
  { color: "bg-yellow-500 hover:bg-yellow-500/90", ring: "ring-yellow-500", Shape: Circle, name: "yellow" },
  { color: "bg-green-600 hover:bg-green-600/90", ring: "ring-green-600", Shape: Square, name: "green" },
];

/** Tile for answer slot `i` (wraps around past 4, though games cap at 4). */
export function answerTile(i: number): AnswerTile {
  return ANSWER_TILES[((i % ANSWER_TILES.length) + ANSWER_TILES.length) % ANSWER_TILES.length];
}
