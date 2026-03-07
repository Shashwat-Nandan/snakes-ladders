export const BOARD_SIZE = 100;

export const PLAYER_COLORS = ["#dc5f3c", "#2e8b57", "#355fd6"];

export const PLAYER_GLOWS = [
  "rgba(220, 95, 60, 0.32)",
  "rgba(46, 139, 87, 0.32)",
  "rgba(53, 95, 214, 0.32)",
];

export function boardOrder() {
  const order = [];

  for (let row = 9; row >= 0; row -= 1) {
    const start = row * 10 + 1;
    const rowSquares = Array.from({ length: 10 }, (_, index) => start + index);
    if ((9 - row) % 2 === 1) {
      rowSquares.reverse();
    }
    order.push(...rowSquares);
  }

  return order;
}
