import { MATCH3_CONFIG } from './Match3Config';
import { Match3Hint, Match3Phase, SwapResult } from './Match3Types';

const CONFIG = MATCH3_CONFIG;
const COLS = CONFIG.columns;
const ROWS = CONFIG.rows;
const CELLS = COLS * ROWS;
const EMPTY = -1;

const INVALID_SWAP: SwapResult = { valid: false, cleared: [], scoreGained: 0 };

function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class Match3Model {
    public phase: Match3Phase = Match3Phase.Play;
    public won = false;
    public score = 0;
    public movesLeft: number = CONFIG.moves;
    public readonly board: number[] = [];

    private readonly random: () => number;

    constructor(seed: number = CONFIG.seed) {
        this.random = mulberry32(seed);
        this.fillInitialBoard();
        this.ensureHint();
    }

    public isAdjacent(a: number, b: number): boolean {
        if (a < 0 || b < 0 || a >= CELLS || b >= CELLS) {
            return false;
        }
        const rowDelta = Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS));
        const colDelta = Math.abs((a % COLS) - (b % COLS));
        return rowDelta + colDelta === 1;
    }

    public swap(a: number, b: number): SwapResult {
        if (this.phase !== Match3Phase.Play || !this.isAdjacent(a, b)) {
            return INVALID_SWAP;
        }

        this.doSwap(a, b);
        if (this.findMatches().size === 0) {
            this.doSwap(a, b);
            return INVALID_SWAP;
        }

        this.movesLeft -= 1;
        const { cleared, gained } = this.resolve();
        this.score += gained;

        if (this.score >= CONFIG.targetScore) {
            this.phase = Match3Phase.End;
            this.won = true;
        } else if (this.movesLeft <= 0) {
            this.phase = Match3Phase.End;
            this.won = false;
        } else {
            this.ensureHint();
        }

        return { valid: true, cleared, scoreGained: gained };
    }

    public hint(): Match3Hint | null {
        for (let cell = 0; cell < CELLS; cell += 1) {
            const right = (cell % COLS) < COLS - 1 ? cell + 1 : -1;
            const down = cell + COLS < CELLS ? cell + COLS : -1;
            for (const other of [right, down]) {
                if (other < 0) {
                    continue;
                }
                this.doSwap(cell, other);
                const creates = this.findMatches().size > 0;
                this.doSwap(cell, other);
                if (creates) {
                    return { a: cell, b: other };
                }
            }
        }
        return null;
    }

    private doSwap(a: number, b: number): void {
        const temp = this.board[a];
        this.board[a] = this.board[b];
        this.board[b] = temp;
    }

    private fillInitialBoard(): void {
        this.board.length = 0;
        for (let cell = 0; cell < CELLS; cell += 1) {
            let color = 0;
            do {
                color = Math.floor(this.random() * CONFIG.gemColors);
            } while (this.createsRun(cell, color));
            this.board.push(color);
        }
    }

    private createsRun(cell: number, color: number): boolean {
        const col = cell % COLS;
        const row = Math.floor(cell / COLS);
        if (col >= 2 && this.board[cell - 1] === color && this.board[cell - 2] === color) {
            return true;
        }
        return row >= 2 && this.board[cell - COLS] === color && this.board[cell - 2 * COLS] === color;
    }

    private findMatches(): Set<number> {
        const matches = new Set<number>();

        for (let row = 0; row < ROWS; row += 1) {
            let runStart = 0;
            for (let col = 1; col <= COLS; col += 1) {
                const same = col < COLS && this.board[row * COLS + col] === this.board[row * COLS + runStart];
                if (same) {
                    continue;
                }
                if (col - runStart >= 3) {
                    for (let i = runStart; i < col; i += 1) {
                        matches.add(row * COLS + i);
                    }
                }
                runStart = col;
            }
        }

        for (let col = 0; col < COLS; col += 1) {
            let runStart = 0;
            for (let row = 1; row <= ROWS; row += 1) {
                const same = row < ROWS && this.board[row * COLS + col] === this.board[runStart * COLS + col];
                if (same) {
                    continue;
                }
                if (row - runStart >= 3) {
                    for (let i = runStart; i < row; i += 1) {
                        matches.add(i * COLS + col);
                    }
                }
                runStart = row;
            }
        }

        return matches;
    }

    // Clears matches, drops gems and refills until the board is stable. Only the
    // first wave is reported for FX so the burst stays readable.
    private resolve(): { cleared: number[]; gained: number } {
        const cleared: number[] = [];
        let gained = 0;

        for (;;) {
            const matches = this.findMatches();
            if (matches.size === 0) {
                break;
            }
            gained += matches.size * CONFIG.pointsPerGem;
            if (cleared.length === 0) {
                cleared.push(...Array.from(matches));
            }
            matches.forEach(cell => {
                this.board[cell] = EMPTY;
            });
            this.applyGravity();
        }

        return { cleared, gained };
    }

    private applyGravity(): void {
        for (let col = 0; col < COLS; col += 1) {
            let writeRow = ROWS - 1;
            for (let row = ROWS - 1; row >= 0; row -= 1) {
                const value = this.board[row * COLS + col];
                if (value === EMPTY) {
                    continue;
                }
                this.board[writeRow * COLS + col] = value;
                writeRow -= 1;
            }
            for (let row = writeRow; row >= 0; row -= 1) {
                this.board[row * COLS + col] = Math.floor(this.random() * CONFIG.gemColors);
            }
        }
    }

    private ensureHint(): void {
        let guard = 0;
        while (!this.hint() && guard < 20) {
            this.fillInitialBoard();
            guard += 1;
        }
    }
}
