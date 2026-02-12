# Games

A collection of classic games built with vanilla HTML, CSS, and JavaScript.

**Play online:** [vikasy.github.io/Games](https://vikasy.github.io/Games/)

## Games

### Tic Tac Toe
Classic grid game vs computer. Supports 3x3, 4x4, and 5x5 boards. Uses the Newell-Simon strategy for computer moves. Early draw detection ends the game when no winning lines remain.

### Texas Hold'em Poker
Full Texas Hold'em with betting against 3 opponents. Features include:
- Chips, blinds ($10/$20), fold/check/call/raise
- Three difficulty levels (Easy, Medium, Hard) with Monte Carlo AI
- Hand strength advisor with win probability estimation
- Hand rankings reference
- Includes a standalone C Monte Carlo simulator (`poker_advisor.c`)

### Deal or No Deal
26 briefcases ranging from $0.01 to $1,000,000. Open cases, evaluate banker offers, and decide: Deal or No Deal? Features banker phone ring sound effect.

## Building the Poker Advisor (C)

```bash
cd playpoker
gcc -O2 -o poker_advisor poker_advisor.c -lm
./poker_advisor Ah Kh Qh Jh 2c 150 40
```

## License

Copyright (c) 2017-2026 Vikas Yadav. All rights reserved. See [LICENSE](LICENSE).
