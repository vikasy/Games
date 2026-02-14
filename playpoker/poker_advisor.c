/********************************************************************
  Author: Vikas Yadav
  Filename: poker_advisor.c
  Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.

  Monte Carlo poker hand strength estimator and betting advisor.
  Given hole cards and community cards, simulates random completions
  to estimate win probability and recommend optimal action.

  Build:  gcc -O2 -o poker_advisor poker_advisor.c -lm
  Usage:  ./poker_advisor <hole1> <hole2> [community1..5] [pot] [to_call]
  Cards:  2h 3s Tc Ad Kc Qd Jh etc.

  Example:
    ./poker_advisor Ah Kh Qh Jh 2c 150 40
    -> Evaluates A♥ K♥ as hole, Q♥ J♥ 2♣ as flop, pot=150, to_call=40
********************************************************************/
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdbool.h>

#define DECK_SIZE       52
#define HAND_SIZE       5
#define NUM_OPPONENTS   3
#define NUM_SIMULATIONS 10000
#define NUM_RANKS       10

typedef struct {
    int face; /* 0=2, 1=3, ..., 12=A */
    int suit; /* 0=heart, 1=spade, 2=club, 3=diamond */
} card_t;

typedef struct {
    int rankVal;  /* 0=Royal Flush .. 9=High Card */
    int high;
    int high2;
    int kicker;
} rank_t;

static const char *RANK_NAMES[NUM_RANKS] = {
    "Royal Flush", "Straight Flush", "Four of a Kind", "Full House",
    "Flush", "Straight", "Three of a Kind", "Two Pair", "One Pair", "High Card"
};

/* Parse a card string like "Ah" "Tc" "2d" */
static bool parse_card(const char *s, card_t *c)
{
    switch (s[0]) {
        case '2': c->face = 0; break;
        case '3': c->face = 1; break;
        case '4': c->face = 2; break;
        case '5': c->face = 3; break;
        case '6': c->face = 4; break;
        case '7': c->face = 5; break;
        case '8': c->face = 6; break;
        case '9': c->face = 7; break;
        case 'T': case 't': c->face = 8; break;
        case 'J': case 'j': c->face = 9; break;
        case 'Q': case 'q': c->face = 10; break;
        case 'K': case 'k': c->face = 11; break;
        case 'A': case 'a': c->face = 12; break;
        default: return false;
    }
    switch (s[1]) {
        case 'h': case 'H': c->suit = 0; break;
        case 's': case 'S': c->suit = 1; break;
        case 'c': case 'C': c->suit = 2; break;
        case 'd': case 'D': c->suit = 3; break;
        default: return false;
    }
    return true;
}

static const char *face_str(int f)
{
    static const char *names[] = {"2","3","4","5","6","7","8","9","T","J","Q","K","A"};
    return names[f];
}

static char suit_char(int s)
{
    return "hscd"[s];
}

/* Evaluate best 5-card hand from exactly 5 cards */
static rank_t rank_hand(card_t hand[5])
{
    rank_t r = {9, -1, -1, -1};
    int faces[5], suits[5];
    int i, j;

    /* Sort by face */
    for (i = 0; i < 5; i++) { faces[i] = hand[i].face; suits[i] = hand[i].suit; }
    for (i = 0; i < 4; i++)
        for (j = i+1; j < 5; j++)
            if (faces[j] < faces[i]) {
                int tf = faces[i]; faces[i] = faces[j]; faces[j] = tf;
                int ts = suits[i]; suits[i] = suits[j]; suits[j] = ts;
            }

    bool is_flush = (suits[0]==suits[1] && suits[1]==suits[2] && suits[2]==suits[3] && suits[3]==suits[4]);

    bool is_straight = false;
    int straight_high = -1;
    bool consec = true;
    for (i = 1; i < 5; i++) if (faces[i] != faces[i-1]+1) { consec = false; break; }
    if (consec) { is_straight = true; straight_high = faces[4]; }
    /* Wheel: A-2-3-4-5 */
    if (!is_straight && faces[0]==0 && faces[1]==1 && faces[2]==2 && faces[3]==3 && faces[4]==12) {
        is_straight = true; straight_high = 3;
    }

    /* Count face occurrences */
    int counts[13] = {0};
    for (i = 0; i < 5; i++) counts[faces[i]]++;

    typedef struct { int face, count; } group_t;
    group_t groups[5];
    int ng = 0;
    for (i = 0; i < 13; i++) if (counts[i]) { groups[ng].face = i; groups[ng].count = counts[i]; ng++; }
    /* Sort groups: by count desc, then face desc */
    for (i = 0; i < ng-1; i++)
        for (j = i+1; j < ng; j++)
            if (groups[j].count > groups[i].count ||
                (groups[j].count == groups[i].count && groups[j].face > groups[i].face)) {
                group_t tmp = groups[i]; groups[i] = groups[j]; groups[j] = tmp;
            }

    if (is_straight && is_flush) {
        r.rankVal = (straight_high == 12) ? 0 : 1;
        r.high = straight_high;
        return r;
    }
    if (groups[0].count == 4) {
        r.rankVal = 2; r.high = groups[0].face; r.kicker = groups[1].face; return r;
    }
    if (groups[0].count == 3 && ng > 1 && groups[1].count == 2) {
        r.rankVal = 3; r.high = groups[0].face; r.high2 = groups[1].face; r.kicker = groups[1].face; return r;
    }
    if (is_flush) {
        r.rankVal = 4; r.high = faces[4]; r.kicker = faces[3]; return r;
    }
    if (is_straight) {
        r.rankVal = 5; r.high = straight_high; return r;
    }
    if (groups[0].count == 3) {
        r.rankVal = 6; r.high = groups[0].face;
        r.kicker = (ng > 1) ? groups[1].face : -1;
        return r;
    }
    if (groups[0].count == 2 && ng > 1 && groups[1].count == 2) {
        int hp = groups[0].face > groups[1].face ? groups[0].face : groups[1].face;
        int lp = groups[0].face < groups[1].face ? groups[0].face : groups[1].face;
        r.rankVal = 7; r.high = hp; r.high2 = lp;
        r.kicker = (ng > 2) ? groups[2].face : -1;
        return r;
    }
    if (groups[0].count == 2) {
        r.rankVal = 8; r.high = groups[0].face;
        int best_k = -1;
        for (i = 1; i < ng; i++) if (groups[i].face > best_k) best_k = groups[i].face;
        r.kicker = best_k;
        return r;
    }
    r.rankVal = 9; r.high = faces[4]; r.high2 = faces[3]; r.kicker = faces[2];
    return r;
}

/* Compare two ranks: returns >0 if a wins, <0 if b wins, 0 if tie */
static int compare_ranks(rank_t *a, rank_t *b)
{
    if (a->rankVal != b->rankVal) return a->rankVal < b->rankVal ? 1 : -1;
    if (a->high != b->high) return a->high > b->high ? 1 : -1;
    if (a->high2 != b->high2) return a->high2 > b->high2 ? 1 : -1;
    if (a->kicker != b->kicker) return a->kicker > b->kicker ? 1 : -1;
    return 0;
}

/* Evaluate best 5 of N cards (N=5,6,7) */
static rank_t best_hand(card_t *cards, int n)
{
    rank_t best = {10, -1, -1, -1};
    int idx[5];
    int a, b, c, d, e;

    for (a = 0; a < n-4; a++)
    for (b = a+1; b < n-3; b++)
    for (c = b+1; c < n-2; c++)
    for (d = c+1; d < n-1; d++)
    for (e = d+1; e < n; e++) {
        card_t hand5[5] = {cards[a], cards[b], cards[c], cards[d], cards[e]};
        rank_t r = rank_hand(hand5);
        if (compare_ranks(&r, &best) > 0)
            best = r;
    }
    return best;
}

/* Fisher-Yates partial shuffle: shuffle first n elements of deck */
static void partial_shuffle(card_t *deck, int deck_size, int n)
{
    for (int i = 0; i < n && i < deck_size-1; i++) {
        int j = i + rand() % (deck_size - i);
        card_t tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
}

/* Check if card is in the used set */
static bool card_in_set(card_t *set, int n, card_t c)
{
    for (int i = 0; i < n; i++)
        if (set[i].face == c.face && set[i].suit == c.suit)
            return true;
    return false;
}

/*
 * Monte Carlo simulation:
 * Given player's hole cards and current community cards,
 * simulate random completions and opponent hands.
 * Returns win probability (0.0 to 1.0).
 * Also fills out best_rank with current best hand info.
 */
static double simulate(card_t hole[2], card_t *community, int num_community,
                       rank_t *best_rank)
{
    int wins = 0, ties = 0, total = 0;

    /* Build remaining deck */
    card_t used[9]; /* max: 2 hole + 5 community + 2 extra */
    int num_used = 0;
    for (int i = 0; i < 2; i++) used[num_used++] = hole[i];
    for (int i = 0; i < num_community; i++) used[num_used++] = community[i];

    card_t remaining[52];
    int num_remaining = 0;
    for (int s = 0; s < 4; s++)
        for (int f = 0; f < 13; f++) {
            card_t c = {f, s};
            if (!card_in_set(used, num_used, c))
                remaining[num_remaining++] = c;
        }

    /* Current best hand if enough cards */
    if (num_community >= 3) {
        card_t all[7];
        all[0] = hole[0]; all[1] = hole[1];
        for (int i = 0; i < num_community; i++) all[2+i] = community[i];
        *best_rank = best_hand(all, 2 + num_community);
    } else {
        best_rank->rankVal = 9;
        best_rank->high = (hole[0].face > hole[1].face) ? hole[0].face : hole[1].face;
        best_rank->high2 = -1;
        best_rank->kicker = -1;
    }

    int cards_to_complete = 5 - num_community;             /* board cards needed */
    int cards_needed = cards_to_complete + 2 * NUM_OPPONENTS; /* total random cards */

    for (int sim = 0; sim < NUM_SIMULATIONS; sim++) {
        partial_shuffle(remaining, num_remaining, cards_needed);

        /* Complete community */
        card_t full_community[5];
        for (int i = 0; i < num_community; i++) full_community[i] = community[i];
        for (int i = 0; i < cards_to_complete; i++) full_community[num_community+i] = remaining[i];

        /* Player's best hand */
        card_t player_cards[7] = {hole[0], hole[1],
            full_community[0], full_community[1], full_community[2],
            full_community[3], full_community[4]};
        rank_t player_rank = best_hand(player_cards, 7);

        /* Opponents' hands */
        bool player_wins = true;
        bool is_tie = false;
        for (int opp = 0; opp < NUM_OPPONENTS; opp++) {
            int base = cards_to_complete + opp * 2;
            card_t opp_cards[7] = {remaining[base], remaining[base+1],
                full_community[0], full_community[1], full_community[2],
                full_community[3], full_community[4]};
            rank_t opp_rank = best_hand(opp_cards, 7);
            int cmp = compare_ranks(&player_rank, &opp_rank);
            if (cmp < 0) { player_wins = false; break; }
            if (cmp == 0) is_tie = true;
        }

        if (player_wins && !is_tie) wins++;
        else if (player_wins && is_tie) ties++;
        total++;
    }

    return (double)wins / total + 0.5 * (double)ties / total;
}

/* Recommend action based on win probability, pot, and amount to call */
typedef struct {
    const char *action;   /* "FOLD", "CHECK", "CALL", "RAISE" */
    int         amount;   /* raise amount (0 if fold/check/call) */
    double      win_pct;
    const char *strength; /* "Very Strong", "Strong", "Medium", "Weak", "Very Weak" */
} advice_t;

static advice_t recommend(double win_pct, int pot, int to_call, int big_blind)
{
    advice_t a;
    a.win_pct = win_pct;
    a.amount = 0;

    /* Strength label */
    if (win_pct >= 0.70)      a.strength = "Very Strong";
    else if (win_pct >= 0.50) a.strength = "Strong";
    else if (win_pct >= 0.35) a.strength = "Medium";
    else if (win_pct >= 0.20) a.strength = "Weak";
    else                      a.strength = "Very Weak";

    /* Pot odds: need to_call to win pot+to_call */
    double pot_odds = (to_call > 0) ? (double)to_call / (pot + to_call) : 0.0;

    if (to_call == 0) {
        /* No bet to match */
        if (win_pct >= 0.65) {
            a.action = "RAISE";
            a.amount = (win_pct >= 0.80) ? big_blind * 4 :
                       (win_pct >= 0.70) ? big_blind * 3 : big_blind * 2;
        } else {
            a.action = "CHECK";
        }
    } else {
        /* Must call or fold */
        if (win_pct < pot_odds * 0.9) {
            a.action = "FOLD";
        } else if (win_pct >= 0.65) {
            a.action = "RAISE";
            a.amount = (win_pct >= 0.80) ? big_blind * 4 :
                       (win_pct >= 0.70) ? big_blind * 3 : big_blind * 2;
        } else {
            a.action = "CALL";
            a.amount = to_call;
        }
    }

    return a;
}

int main(int argc, char *argv[])
{
    card_t hole[2];
    card_t community[5];
    int num_community = 0;
    int pot = 0, to_call = 0;
    int big_blind = 20;

    if (argc < 3) {
        printf("Usage: %s <hole1> <hole2> [community1..5] [pot] [to_call]\n", argv[0]);
        printf("Cards: 2h 3s Tc Ad Kc Qd Jh etc.\n");
        printf("Example: %s Ah Kh Qh Jh 2c 150 40\n", argv[0]);
        return 1;
    }

    srand((unsigned)time(NULL));

    /* Parse hole cards */
    if (!parse_card(argv[1], &hole[0]) || !parse_card(argv[2], &hole[1])) {
        printf("Error: invalid hole card format.\n");
        return 1;
    }

    /* Parse remaining args: community cards first, then numeric pot/to_call */
    int arg_idx = 3;
    while (arg_idx < argc && num_community < 5) {
        card_t c;
        if (parse_card(argv[arg_idx], &c)) {
            community[num_community++] = c;
            arg_idx++;
        } else {
            break;
        }
    }
    if (num_community == 1 || num_community == 2) {
        printf("Error: community cards must be 0 (pre-flop), 3 (flop), 4 (turn), or 5 (river).\n");
        return 1;
    }
    /* Check for duplicate cards */
    {
        card_t all_cards[7];
        int n = 0;
        all_cards[n++] = hole[0]; all_cards[n++] = hole[1];
        for (int i = 0; i < num_community; i++) all_cards[n++] = community[i];
        for (int i = 0; i < n; i++)
            for (int j = i+1; j < n; j++)
                if (all_cards[i].face == all_cards[j].face && all_cards[i].suit == all_cards[j].suit) {
                    printf("Error: duplicate card %s%c detected.\n",
                        face_str(all_cards[i].face), suit_char(all_cards[i].suit));
                    return 1;
                }
    }
    if (arg_idx < argc) pot = atoi(argv[arg_idx++]);
    if (arg_idx < argc) to_call = atoi(argv[arg_idx++]);

    /* Print input */
    printf("Hole cards: %s%c %s%c\n",
        face_str(hole[0].face), suit_char(hole[0].suit),
        face_str(hole[1].face), suit_char(hole[1].suit));
    if (num_community > 0) {
        printf("Community:  ");
        for (int i = 0; i < num_community; i++)
            printf("%s%c ", face_str(community[i].face), suit_char(community[i].suit));
        printf("\n");
    }
    printf("Pot: $%d  To call: $%d\n\n", pot, to_call);

    /* Run simulation */
    rank_t current_rank;
    double win_pct = simulate(hole, community, num_community, &current_rank);

    printf("Current hand: %s\n", (current_rank.rankVal < NUM_RANKS) ?
        RANK_NAMES[current_rank.rankVal] : "N/A");
    printf("Win probability: %.1f%% (%d simulations vs %d opponents)\n",
        win_pct * 100.0, NUM_SIMULATIONS, NUM_OPPONENTS);

    /* Get recommendation */
    advice_t advice = recommend(win_pct, pot, to_call, big_blind);
    printf("\nHand strength: %s\n", advice.strength);
    printf("Recommendation: %s", advice.action);
    if (strcmp(advice.action, "RAISE") == 0)
        printf(" $%d", advice.amount);
    else if (strcmp(advice.action, "CALL") == 0)
        printf(" $%d", to_call);
    printf("\n");

    return 0;
}
