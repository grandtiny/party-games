import {
  solve_vcf,
  solve_vct,
  decode_x,
  decode_y
} from "../packages/gomoku/node_modules/@renju-note/quintet/quintet.js";

const targetPerKind = Number.parseInt(process.argv[2] ?? "12", 10);
const maxAttempts = Number.parseInt(process.argv[3] ?? "6000", 10);
const minSolutionLength = Number.parseInt(process.argv[4] ?? "5", 10);
const maxSolutionLength = Number.parseInt(process.argv[5] ?? "13", 10);
const found = { vcf: [], vct: [] };
const seen = new Set();
let randomState = 0x51f15e5d;

for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
  if (attempt > 0 && attempt % 250 === 0) {
    process.stderr.write(`attempt ${attempt}, vcf ${found.vcf.length}, vct ${found.vct.length}\n`);
  }
  const state = randomGame(18 + randomInt(18));
  if (!state || state.result) continue;
  const encoded = encodeState(state);
  const key = state.moves.map((move) => `${move.player[0]}${move.x},${move.y}`).join("|");
  if (seen.has(key)) continue;

  if (found.vcf.length < targetPerKind) {
    const path = solve_vcf(encoded.black, encoded.white, state.currentPlayer === "black", 7);
    if (path && path.length >= minSolutionLength && path.length <= maxSolutionLength) {
      seen.add(key);
      found.vcf.push({ state, solution: decodePath(path) });
      process.stderr.write(`found vcf ${found.vcf.length} at attempt ${attempt}, length ${path.length}\n`);
    }
  }

  if (found.vct.length < targetPerKind) {
    const vcf = solve_vcf(encoded.black, encoded.white, state.currentPlayer === "black", 7);
    if (!vcf) {
      const path = solve_vct(encoded.black, encoded.white, state.currentPlayer === "black", 5);
      if (path && path.length >= minSolutionLength && path.length <= maxSolutionLength) {
        seen.add(key);
        found.vct.push({ state, solution: decodePath(path) });
        process.stderr.write(`found vct ${found.vct.length} at attempt ${attempt}, length ${path.length}\n`);
      }
    }
  }

  if (found.vcf.length >= targetPerKind && found.vct.length >= targetPerKind) break;
}

process.stdout.write(`${JSON.stringify(found, null, 2)}\n`);

function randomGame(moveTarget) {
  const moves = [];
  for (let index = 0; index < moveTarget; index += 1) {
    const candidates = candidateMoves(moves, index < 4 ? 1 : 2);
    if (candidates.length === 0) return undefined;
    const centerWeighted = candidates
      .map((point) => ({
        point,
        score:
          Math.abs(point.x - 7) +
          Math.abs(point.y - 7) +
          randomInt(8)
      }))
      .sort((left, right) => left.score - right.score)
      .slice(0, Math.min(12, candidates.length));
    const selected = centerWeighted[randomInt(centerWeighted.length)]?.point;
    if (!selected) return undefined;
    const move = {
      ...selected,
      player: index % 2 === 0 ? "black" : "white",
      moveNumber: index + 1
    };
    moves.push(move);
    if (hasFive(moves, move)) return undefined;
  }
  return {
    moves,
    currentPlayer: moves.length % 2 === 0 ? "black" : "white"
  };
}

function encodeState(state) {
  return {
    black: Uint8Array.from(
      state.moves.filter((move) => move.player === "black").map(encodePoint)
    ),
    white: Uint8Array.from(
      state.moves.filter((move) => move.player === "white").map(encodePoint)
    )
  };
}

function encodePoint(point) {
  return point.x * 15 + point.y;
}

function decodePath(path) {
  return [...path].map((value) => ({ x: decode_x(value), y: decode_y(value) }));
}

function randomInt(max) {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) % Math.max(1, max);
}

function candidateMoves(moves, radius) {
  if (moves.length === 0) return [{ x: 7, y: 7 }];
  const occupied = new Set(moves.map((move) => `${move.x}:${move.y}`));
  const candidates = new Map();
  for (const move of moves) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const point = { x: move.x + dx, y: move.y + dy };
        const key = `${point.x}:${point.y}`;
        if (
          point.x >= 0 &&
          point.y >= 0 &&
          point.x < 15 &&
          point.y < 15 &&
          !occupied.has(key)
        ) {
          candidates.set(key, point);
        }
      }
    }
  }
  return [...candidates.values()];
}

function hasFive(moves, lastMove) {
  const occupied = new Set(
    moves
      .filter((move) => move.player === lastMove.player)
      .map((move) => `${move.x}:${move.y}`)
  );
  return [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => {
    let length = 1;
    for (const sign of [-1, 1]) {
      for (let distance = 1; distance < 15; distance += 1) {
        if (!occupied.has(`${lastMove.x + dx * distance * sign}:${lastMove.y + dy * distance * sign}`)) break;
        length += 1;
      }
    }
    return length >= 5;
  });
}
