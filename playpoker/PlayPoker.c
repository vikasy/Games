/********************************************************************
  Author: Vikas YADAV (vikasy@gmail.com)
  Filename: PlayPoker.c
  Topic: Texas Holdem Poker game

  Objective: Implement Texas Holdem Poker, where a user can play against 
  multiple users. 
  This is "money-less" poker for now, where no user input is involved.
  To be extended to user interaction later on.

  A hand consists of 5 cards. A player can select 5 best cards out of 7 
  available cards. The 7 available cards include two players own hole 
  cards and 5 community cards.
  
  It is possible to use more than one deck.
  
  Input: None
  
  NOTE:  None

********************************************************************/
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <stdbool.h>


#define DECK_SIZE        (52)
#define NUM_DECK         (2)
#define MAX_PLAYERS      (10)
#define NCARD_PER_SUIT   (13)
#define MAX_CARD_PLAYER  (13)
#define HAND_SIZE        (5)
#define CARDS_PER_PLAYER (2)
#define CARDS_ON_BOARD   (5)
#define NUM_BOARD_CARD_1 (3)
#define NUM_BOARD_CARD_2 (1)
#define NUM_BOARD_CARD_3 (1)
#define MAX_NUM_PAIR     (2)
#define MAX_ACES_INHAND  (HAND_SIZE)
#define START_FUND       (1000)
#define MAX_NUM_GAMES    (1000*1000*100)

//#define DBG              
#define DBG              for(;0;)
//#define USER_INPUT  //if user input is not defined, program runs nonstop MAX_NUM_GAMES times
#define TESTING

#ifdef TESTING
#ifdef DBG
#undef DBG
#define DBG
#endif
#ifdef USER_INPUT
#undef USER_INPUT
#endif 
#ifdef MAX_NUM_GAMES
#undef MAX_NUM_GAMES
#define MAX_NUM_GAMES    (12)
#endif
// assumes four players, 2 cards/player and 5 board cards (2*4+5 =13 cards)
// any change to num of players require change in test data table in getTestData fn
#define NUM_PLAYERS      ( 4 )
#define TOTAL_NUM_CARDS  (2*NUM_PLAYERS + 5)
#endif /* TESTING */


// Data type defs 
typedef enum Suits {
    HEART,
    SPADE,
    CLUB,
    DIAMOND,
    NUM_SUITS
} suits_t;

typedef enum Faces {
    One,
    Two,
    Three,
    Four,
    Five,
    Six,
    Seven,
    Eight,
    Nine,
    Ten,
    Jack,
    Queen,
    King,
    Ace,
    Joker,
    Num_Faces
} faces_t;

enum ranks {
    Royal_Flush,    // RF, A-K-Q-J-10 of same suit
    Straight_Flush, // SF, sequence of same suit
    Four_Ofa_Kind,  // 4K, 4 of same suit
    Full_House,     // FH, 3 of a suit + 2 of other suit
    Flush,          // FL, 5 of same suit
    Straight,       // ST, sequence (any comb of suit)
    Three_Ofa_Kind, // 3K, 3 of same suit
    Two_Pair,       // 2P, 2 of a face + 2 of another face
    One_Pair,       // 1P, 2 of same face
    High_Card,      // HC, card rank (A,K,Q,J,10,...,2)
    NUM_RANKS
};


typedef struct rank {
    enum ranks         rankval;
    faces_t            pair[MAX_NUM_PAIR];
    faces_t            kicker;
    unsigned int       rank_score;
    unsigned int       high_score;
    unsigned int       kicker_score;
} rank_t;

typedef struct card {
    suits_t  suit;
    faces_t  face;
    bool     indeck;
} card_t;

typedef union {
    struct cfg {
        unsigned short hearts;  // bit map, nth bit indicating presence of nth face
        unsigned short spades;
        unsigned short clubs;
        unsigned short diamonds;
    } suit;
    unsigned long long allsuits;
} card_cfg_t;

typedef struct player {
    char      *name;
    card_t     cards[MAX_CARD_PLAYER];
    card_cfg_t card_cfg;
    int        num_cards;
    rank_t     rank;
    int        fund_avail;
    bool       is_dealer;
    bool       in_play;
} player_t;

typedef struct hand {
    card_t card;
    bool   is_from_board;
} hand_t;


// Constant global consts 
const static char  face_symbols[Num_Faces+1] = {'A','2','3','4','5','6','7','8','9','T','J','Q','K','A','*','0'};
const static char  suit_symbols[NUM_SUITS] = {'H','S','C','D'};
const static char *rank_list[NUM_RANKS] = {"Royal Flush",
                                           "Straight Flush",
                                           "Four of a Kind",
                                           "Full House",
                                           "Flush",
                                           "Straight",
                                           "Three of a Kind",
                                           "Two Pairs",
                                           "One Pair",
                                           "High Card"};


// Static global variables
static card_t    deck[NUM_DECK][DECK_SIZE];
static int       top_of_deck = 0;
static int       deck_cut_val = 0;
static player_t  players[MAX_PLAYERS];
static int       num_players;
static int       dealer_idx;
static int       rand_num;

// Function prototypes
static void fillDeck( void );
static void shuffleDeck( void );
static void cutDeck( void );
static bool dealCards( int num, player_t *player );
static void showPlayer( player_t *player );
static void showDeck( void );
static void setCardCfg( player_t *player, card_t card);
static void getRank( player_t *player, player_t *board );
static void decideWinner( int num_winner[] );
#ifdef TESTING
static bool getTestData(int testfaces[], int testsuits[], int testnum);
#endif

// Main entry 
int main( void ) 
{
    int       i = 0;
    bool      retval = false;
    int       cont = MAX_NUM_GAMES;
    int       seed = 0;
    int       match_num = 0;
    char     *player_names[MAX_PLAYERS] = {0};
    int       num_win[MAX_PLAYERS] = {0};  // contains number of times each playes has won
    int       rank_stats[NUM_RANKS] = {0}; // contains frequency of each rank occurence 
    clock_t   start_time =0, end_time = 0;
    double    time_in_sec = 0.0;
    player_t  board = players[0];
#ifdef USER_INPUT
    char      select;
#endif

    num_players = 5; // including board, in future these should be user selectable
    player_names[0] = "Board"; 
    player_names[1] = "PlayerA"; 
    player_names[2] = "PlayerB"; 
    player_names[3] = "PlayerC"; 
    player_names[4] = "PlayerD";

    dealer_idx = 0;
    
    seed = (int)time(NULL);
    srand(seed);
    DBG printf("seed=%d\n",seed);

    // clear screen
    //system("cls");
    printf("\n~~ Lets play Texas Holdem Poker! ~~\n");
    
    // Play multiple matches
    do {
        ++match_num;

        DBG printf("\nThis is match #%d\n", match_num);

        // Get a deck
        fillDeck();
        
        // Set player info
        for(i=1; i<num_players; ++i) {
            players[i].name = player_names[i];
            players[i].fund_avail = START_FUND;
        }
        // The game is setup now
         
        // Set the dealer to start with
        players[dealer_idx%(num_players-1) +1].is_dealer = true;
        DBG printf("%s is the dealer.\n",players[dealer_idx%(num_players-1) +1].name);
        ++dealer_idx;

        shuffleDeck();
        cutDeck();
        showDeck();

#ifdef TESTING
        // For testing overwrites the deck card with test inputs
        int testfaces[TOTAL_NUM_CARDS];
        int testsuits[TOTAL_NUM_CARDS];
        static int testnum = 0;
        retval = getTestData(testfaces, testsuits, testnum++);
        if (retval == false) {
            printf("Error testing inputs.\n");
            return -1;
        }
        for (int k = 0; k < 13; ++k) {
            deck[0][k].face = testfaces[k];
            deck[0][k].suit = testsuits[k];
        }
        top_of_deck = 0;
#endif /* TESTING */

        // Deal cards to each player
        for(i=1; i<num_players; ++i) {
            players[i].is_dealer = false;
            players[i].in_play = true;
            players[i].num_cards = 0;
            players[i].card_cfg.allsuits = 0;
            retval = dealCards( CARDS_PER_PLAYER, players+i);
            if( retval == false ) {
                DBG printf("No more cards to deal\n");
                break;
            }
        }
        
        // Set up the board 
        board.name = player_names[0];
        board.fund_avail = 0;
        board.is_dealer = false;
        board.in_play = false;
        board.num_cards = 0;
        board.card_cfg.allsuits = 0;

        // board cards are community cards belong to all players, form the extended hand of 7 cards

        // Since this is "money-less" poker, there is no bet or move required
        // Skip all betting stages
        // At the end, go by the ranking of players and decide the winner
        
        // Pre-flop betting
        DBG printf("\n  1. Pre-flop betting skipped.\n\n");
        
        // Deal starting set of 3 cards to the board 
        retval = dealCards( NUM_BOARD_CARD_1, &board);
        if( retval == false ) {
           DBG printf("No more cards to deal!!!!\n");
        }
        // show board, board is visible to all players
        showPlayer( players );
        
        // The flop betting
        DBG printf("\n  2. The flop betting skipped.\n\n");
        
        // deal one more card to the board
        retval = dealCards( NUM_BOARD_CARD_2, &board);
        if( retval == false ) {
           DBG printf("No more cards to deal!!!!\n");
        }
        // show board, board is visible to all players
        showPlayer( players );
        
        // The turn betting
        DBG printf("\n  3. The turn betting skipped.\n\n");
        
        // deal one more card to the board
        retval = dealCards( NUM_BOARD_CARD_3, &board);
        if( retval == false ) {
           DBG printf("No more cards to dea!!!!\n");
        }
        // show board, board is visible to all players
        showPlayer( players );
        
        // The river betting
        DBG printf("\n  4. The river betting skipped.\n");
        
        // All betting and dealing is done: The show time
        DBG printf("\n  The SHOW time.\n\n");
        
        // show all players
        DBG printf("  HOLE CARDS\n");
        for(i=1; i<num_players; ++i) {
            showPlayer( players+i );
        }
        DBG printf("\n");

        // get player ranks
        start_time = clock();
        for(i=1; i<num_players; ++i) {
            // get rank of ith player
            getRank( players+i, &board);
            // record the ranking in the bitmaps for easy comparison with other players
            if (players[i].rank.rankval < NUM_RANKS) {
                players[i].rank.rank_score = 1 << (NUM_RANKS - players[i].rank.rankval - 1);
                players[i].rank.high_score = (1 << (players[i].rank.pair[0] + 1));
                players[i].rank.high_score |= ((1 << (players[i].rank.pair[1] + 1))&0xFFFF);
                players[i].rank.kicker_score = 1 << (players[i].rank.kicker + 1);
                ++rank_stats[players[i].rank.rankval];
            }
        }
        end_time = clock();
        time_in_sec += (end_time-start_time);
        DBG printf("\n");

        // find the winner based on the ranks of their hands
        decideWinner( num_win );
    
        // Print history data
        DBG printf("\n  PLAYER WINNING RECORD:\n");
        for( i=1; i<num_players; i++ )
            DBG printf("%s won %d matches making %s%d\n", players[i].name, num_win[i], (players[i].fund_avail>=START_FUND)?"$":"-$", (players[i].fund_avail>=START_FUND)?(players[i].fund_avail-START_FUND):(START_FUND-players[i].fund_avail));
        DBG printf("\n");
                

#ifdef USER_INPUT
        // Check players if they want to play again:
        cont = 1;
        DBG printf("\nDo you want to play once more [Y/N]:");
        select = getchar(); // user input
        if( select != 'Y' && select != 'y' && select != 'N' && select != 'n' ) {
            DBG printf("\nInvalid entry (valid=Y/y/N/n), Exiting!\n");
            cont = 0;
        }
        if( select == 'N' || select == 'n' ) {
            cont = 0;
            DBG printf("\nBye!\n");
        }
        select = getchar(); // eat the null char
#else
        cont--;
#endif /* USER_INPUT */

        // Rank statistics at the end of game
        if( cont == 0 ) {
            printf("\n  Rank statistics after %d matches:\n",match_num);
            for( i=0; i<NUM_RANKS; ++i )
                printf("%15s : %8.4f%%\n",rank_list[i],100*(float)rank_stats[i]/(match_num*(num_players-1)));
            printf("\n");
        }

    } while( cont );
    
    time_in_sec /= CLOCKS_PER_SEC;
    printf("\nTotal time in sec using clock_t = %f\n", time_in_sec);
    
    return 0;
    
}


// Reset a deck to contain all suits and faces in an order
static void fillDeck( void )
{
    int i, j;

    for( i=0; i<NUM_DECK; ++i ) {
        for( j=0; j<DECK_SIZE; ++j) {
            deck[i][j].face = j%NCARD_PER_SUIT; 
            deck[i][j].suit = j/NCARD_PER_SUIT;
            deck[i][j].indeck = true;
        }
    }
    top_of_deck = 0;
    DBG printf("\nGetting new deck of %d cards... Done.\n",NUM_DECK*DECK_SIZE);
}


// Fisher and Yates & Durstenfield method to shuffle the deck
static void shuffleDeck( void )
{
    int    i, j;
    card_t temp;
    
    rand_num = rand();
    
    // for shuffling, treat all decks together as one big deck
    for( i=DECK_SIZE*NUM_DECK-1; i>0; i--) {
        j = rand_num%i;    
        temp = ((card_t *)deck)[i];
        ((card_t *)deck)[i] = ((card_t *)deck)[j];
        ((card_t *)deck)[j] = temp;
    }
    top_of_deck = 0;
    DBG printf("\nDeck shuffling... Done.\n");
}


// Cut deck with help of a player next to dealer
static void cutDeck( void )
{
#ifdef USER_INPUT
    char dummy_char;
#endif
    int  i;
    
    // get player who will cut
    for(i=1; i<num_players; ++i) {
        if( players[i].is_dealer ) {
            ++i;
            break;
        }
    }
    if( i==num_players ) i=1;

#ifdef USER_INPUT
    // Ask player[i] to cut
    DBG printf("%s please cut the deck by entering the cut position:",players[i].name);
    scanf("%d",&deck_cut_val);
    scanf("%c",&dummy_char);
#else
    deck_cut_val = rand_num % (DECK_SIZE*NUM_DECK);
#endif /* USER_INPUT */

    DBG printf("%d\n",deck_cut_val);
    if( deck_cut_val <0 || deck_cut_val >= DECK_SIZE*NUM_DECK) deck_cut_val = 0;
    top_of_deck = deck_cut_val;

}


// Update bitmap data for a card with a player
static void setCardCfg( player_t *player, card_t card)
{
    switch (card.suit) {
    case HEART:
        player->card_cfg.suit.hearts |= (1 << card.face);
        break;
    case SPADE:
        player->card_cfg.suit.spades |= (1 << card.face);
        break;
    case CLUB:
        player->card_cfg.suit.clubs |= (1 << card.face);
        break;
    case DIAMOND:
        player->card_cfg.suit.diamonds |= (1 << card.face);
        break;
    case NUM_SUITS:
        printf("UNEXPECTED ERROR!\n");
    default:
        break;
    }
}


// Deal cards to specified player, 
// return false if fail to give requested number of cards
static bool dealCards( int num, player_t *player)
{
    int i, count, start_idx;
    
    count = 0;
    start_idx = player->num_cards;
    
    if( num>MAX_CARD_PLAYER ) {
        DBG printf("A player cannot take more than max num cards.\n");
        return false;
    }
    
    // for dealing, treat all decks together as one big deck
    for(i=top_of_deck; count<num; ++i) {
        if (i == DECK_SIZE*NUM_DECK) i = 0;
        if( ((card_t *)deck)[i].indeck ) {
            ((card_t *)deck)[i].indeck = false;
            player->cards[start_idx+count] = ((card_t *)deck)[i];
            setCardCfg(player, ((card_t *)deck)[i]);
            ++count;
        }
    }
    
    if( count<num ) {
        DBG printf("Not enogh cards in deck for this player.\n");
        return false;
    }
    
    player->num_cards += num;
    top_of_deck += num; 
    top_of_deck = top_of_deck%(DECK_SIZE*NUM_DECK);

    DBG printf("Dealing %d card%s to %s.\n",num,(num>1)?"s":"",player->name);
    
    return true;
    
}


// Print out each players hole/pocket cards 
static void showPlayer( player_t *player )
{
    int i;
    
    DBG printf("%s has %d cards: ",player->name, player->num_cards);
    for( i=0; i<player->num_cards; ++i)
        DBG printf("%c%c ",face_symbols[player->cards[i].face], suit_symbols[player->cards[i].suit]);
    DBG printf("\n");
    
}


// Print out the current deck cards in sequence after shuffling/dealing
static void showDeck( void )
{
    int i;
    int deck_no;
    int deck_pos;
    
    deck_no = top_of_deck/DECK_SIZE;
    deck_pos = top_of_deck%DECK_SIZE;
    
    DBG printf("\nCURRENT DECK IS:\n");
    for( i=top_of_deck; i<DECK_SIZE*NUM_DECK+top_of_deck; ++i ) {
        deck_no = (i/DECK_SIZE)%NUM_DECK;
        deck_pos = i%DECK_SIZE;
        if( deck[deck_no][deck_pos].indeck ) {
            DBG printf("%c%c ",face_symbols[deck[deck_no][deck_pos].face],
                           suit_symbols[deck[deck_no][deck_pos].suit]);
            if( (i-top_of_deck)%NCARD_PER_SUIT == NCARD_PER_SUIT-1 ) DBG printf("|\n");
        }
    }
    DBG printf("\n");
}


/*
 THIS IS THE ENGINE, THE WORKHORSE.

 The following is the definition of various ranks in decreasing order of strength:
 1. Royal Flush    (RF) A-K-Q-J-10 of same suit
 2. Straight Flush (SF) a sequence (5 consecutive) of same suit
 3. Four of a Kind (4K) 4 of same face
 4. Full House     (FH) 3 of a face + 2 of another face
 5. Flush          (FL) 5 of same suit
 6. Straight       (ST) a sequence (any comb of suit)
 7. Three of a Kind(3K) 3 of same face
 8. Two Pair       (2P) 2 of a face + 2 of another face
 9. One Pair       (1P) 2 of same face
 10. High Card     (HC) the highest card (A,K,Q,J,10,...,2)
 
 Kicker is the highest single card in a player hand after not including cards used for getting 
 a particular rank . This happens in case of 4K,3K,2P,1P,HC. Kicker card is used for breaking
 tie between players with the same rank hand. For simplicity, the second highest or third highest 
 are not considered in case of same kicker. Tie means split the win in equal parts.
 A bitmap data structure is used to record rank, highest cards used in the rank, and kicker card.
 This data is created in getRank function.
 */

static const unsigned long long  cfg_mask[] = {1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192};
static hand_t                    player_hand[CARDS_PER_PLAYER+CARDS_ON_BOARD+MAX_ACES_INHAND] = { 0 };

static void getRank( player_t *player, player_t *board )
{
    bool          is_flush = false;
    bool          is_straight = false;
    bool          is_threeakind = false;
    int           i = 0, j = 0, k = 0, count = 0;
    int           num_aces = 0;
    faces_t       highest_face = Num_Faces;
    card_cfg_t    card_cfg = player->card_cfg;
    int           Indx[4] = { 0 };
    faces_t       face_occur[4][7];
    int           present = 0;
    unsigned long long mask = 0;
    faces_t       temp_face = Num_Faces;

    // initialize to invalid values to differentiate from setting by an valid val
    // rank_score is bitmap of rankval (if rank = 9 (1P), then 9th bit is set)
    // high_score is bitmap of face of cards used for rank (if face = J (1P), then 10th(=11-1) bit is set)
    // kicker_score is bitmap of kicker card (if kicker card face = A, then 13th bit is set)
    player->rank.pair[0] = Num_Faces;
    player->rank.pair[1] = Num_Faces;
    player->rank.rankval = NUM_RANKS;
    player->rank.kicker = Num_Faces;
    player->rank.rank_score = 0;
    player->rank.high_score = 0;
    player->rank.kicker_score = 0;

    // Create bitmap of players own cards and board cards combined
    card_cfg.allsuits |= board->card_cfg.allsuits;
    
    // build player hand (sorted) using card config info 
    for(j=0, i=0; j<NCARD_PER_SUIT && i<CARDS_PER_PLAYER+CARDS_ON_BOARD; ++j) {
        for (k=0; k<4; ++k) {
            present = (int)((card_cfg.allsuits & (cfg_mask[j] << 16*k)) != 0);
            player_hand[i].card.face = j*present;
            player_hand[i].card.suit = k;
            i = i + present;
        }
    }

    DBG printf("%s's extended hand (sorted) inc %d board cards: ", player->name, CARDS_ON_BOARD);
    for (i = 0; i<CARDS_PER_PLAYER + CARDS_ON_BOARD; ++i)
        DBG printf("%c%c ", face_symbols[player_hand[i].card.face], suit_symbols[player_hand[i].card.suit]);
    DBG printf("\n");

    // check if there are 5 cards of same suite
    for( i=CARDS_PER_PLAYER+CARDS_ON_BOARD; i>HAND_SIZE-1 && count<HAND_SIZE-1; --i ) {
        count = 0;
        highest_face = player_hand[i-1].card.face;
        for( j=i-2; j>=0 && count<HAND_SIZE-1; j--) {
            count += (int)(player_hand[j].card.suit == player_hand[i - 1].card.suit);
        }
    }
    is_flush = (count == HAND_SIZE-1);
    
    // Copy all aces in front to the end for easy counting of sequence
    num_aces = 0;
    while( player_hand[num_aces].card.face==One && num_aces<MAX_ACES_INHAND ) {
        player_hand[CARDS_PER_PLAYER+CARDS_ON_BOARD+num_aces].card = player_hand[num_aces].card;
        player_hand[CARDS_PER_PLAYER+CARDS_ON_BOARD+num_aces].card.face = Ace;
        ++num_aces;
    }
    
    // now check if they is a consecitive sequence of length 5
    count = 0;
    i = CARDS_PER_PLAYER+CARDS_ON_BOARD+num_aces;
    while( count < HAND_SIZE-1 && --i>0 ) {
        // inc count for every pair of consecutive cards back to back
        // reset the count to 0 if cards not consecutive
        count = (count+1)*(int)(player_hand[i].card.face==player_hand[i-1].card.face + 1);
    }
    
    // if there is a sequence, it could be Royal Flush, Straigth Flush or just Straight
    if( count == HAND_SIZE-1 ) { 
        while( (player_hand[i].card.suit==player_hand[i-1].card.suit) 
               && count>0 && i<CARDS_PER_PLAYER+CARDS_ON_BOARD+num_aces ) {
            --count;
            ++i;
        }
        if( count>0 ) {
            is_straight = !is_flush;
            highest_face = highest_face*(int)is_flush + player_hand[i+count-1].card.face*(int)is_straight;
        }
        else if( (highest_face = player_hand[i+count-1].card.face) != Ace ) {
/*STRAIGHT FLUSH*/
            player->rank.pair[0] = highest_face;
            player->rank.rankval = Straight_Flush;
            return;
        }
        else {
/*ROYAL FLUSH*/
            player->rank.pair[0] = Ace;
            player->rank.rankval = Royal_Flush;
            return;
        }
    }

    // record number of faces that occur 4 times or 2 times or 2 times or only 1
    for( count=1, i=num_aces; i<CARDS_PER_PLAYER+CARDS_ON_BOARD+num_aces-1; ++i) {
        // record faces that occur N times (N=4,3,2,1) 
        /*
        present = (int)(player_hand[i].card.face == player_hand[i + 1].card.face);
        count = count + present;
        count = (count> 4) ? 4 : count;
        temp_face = (present)?face_occur[count-1][Indx[count-1]]:player_hand[i].card.face;
        face_occur[count-1][Indx[count-1]] = temp_face; // 0 based indexing
        Indx[count-1] = (present) ? Indx[count-1] : Indx[count-1]++;
        */
        if (player_hand[i].card.face != player_hand[i + 1].card.face) {
            count = (count> 4) ? 4 : count;
            face_occur[count - 1][Indx[count - 1]++] = player_hand[i].card.face; // 0 based indexing
            count = 1;
        }
        else {
            count++;
        }
    }
    count = (count> 4)? 4:count;
    face_occur[count-1][Indx[count-1]++] = player_hand[i].card.face;
    
    for( count=4; count>0; --count ) {
        if( Indx[count-1] ) {
            
            if( count == 4 ) {
/*FOUR OF A KIND*/
                player->rank.pair[0] = face_occur[count-1][Indx[count-1]-1];
                player->rank.rankval = Four_Ofa_Kind;
                // pick kicker as the highest card in hand, if any, with face different from rank face(s)
                for(i=CARDS_PER_PLAYER+CARDS_ON_BOARD+num_aces-1;player_hand[i].card.face==player->rank.pair[0] && --i>0;);
                player->rank.kicker = player_hand[i].card.face;
                // this is the highest rank based on number of occurence, so stop checking anymore
                return;
            }

            if( count == 3 ) {
                // possible: full house(=two three of a kinds or three of a kind and two of a kind)
                if( Indx[count-1] > 1 || Indx[count-2] > 0 ) { // this is full house
/*FULL HOUSE */                
                    player->rank.pair[0] = face_occur[count-1][Indx[count-1]-1];
                    if( Indx[count-1] > 1 ) {
                        player->rank.pair[1] = face_occur[count-1][Indx[count-1]-2];
                        if( Indx[count-2] > 0 && face_occur[count-2][Indx[count-2]-1] > player->rank.pair[1] )
                            player->rank.pair[1] = face_occur[count-2][Indx[count-2]-1];
                    }
                    else {
                        player->rank.pair[1] = face_occur[count-2][Indx[count-2]-1];
                    }
                    player->rank.rankval = Full_House;
                    player->rank.kicker = player->rank.pair[1];
                    return;
                }
                // else just a three of a kind
                if( Indx[count-1] == 1  ) { 
                    is_threeakind = true;
                    player->rank.pair[0] = face_occur[count-1][Indx[count-1]-1];
                }
            }
            
            if( is_flush ) {
/*FLUSH*/
                player->rank.pair[0] = highest_face;
                player->rank.pair[1] = Num_Faces;
                player->rank.rankval = Flush;
                   return;
            }
            
            if( is_straight ) {
/*STRAIGHT*/
                player->rank.pair[0] = highest_face;
                player->rank.pair[1] = Num_Faces;
                player->rank.rankval = Straight;
                return;
            }
            
            if( is_threeakind ) { 
/*THREE OF A KIND*/
                player->rank.rankval = Three_Ofa_Kind;
                // pick kicker as the highest card in hand, if any, with face different from rank face(s)
                for (i = CARDS_PER_PLAYER + CARDS_ON_BOARD + num_aces - 1; player_hand[i].card.face == player->rank.pair[0] && --i>0;);
                player->rank.kicker  = player_hand[i].card.face;
                return;
            }
            
            if( count == 2 ) {
                if( Indx[count-1] > 1 ) { // two pairs
/*TWO PAIRS*/                
                    //is_twopair = true;
                    player->rank.pair[0] = face_occur[count-1][Indx[count-1]-1];
                    player->rank.pair[1] = face_occur[count-1][Indx[count-1]-2];
                    player->rank.rankval = Two_Pair;
                    player->rank.kicker = player->rank.pair[1];
                    return;
                }
                if( Indx[count-1] == 1 ) {
/*ONE PAIR*/                        
                    //is_twoakind = true;
                    player->rank.pair[0] = face_occur[count-1][Indx[count-1]-1];
                    player->rank.rankval = One_Pair;
                    for (i = CARDS_PER_PLAYER + CARDS_ON_BOARD + num_aces - 1; player_hand[i].card.face == player->rank.pair[0] && --i>0;);
                    player->rank.kicker = player_hand[i].card.face;
                    return;
                }
            }
            
            if( count == 1 ) { // only a high card
/*HIGHCARD*/
                player->rank.rankval = High_Card;
                player->rank.pair[0] = face_occur[count-1][Indx[count-1]-1];
                player->rank.kicker  = face_occur[count-1][Indx[count-1]-2];
                player->rank.pair[1] = face_occur[count-1][Indx[count-1]-3];
            }
            
        } /* if( Indx[count-1] */
    } /* for */
    
}


/*
In order to decide the winner of a poker game based on the ranks of players hands, the following
strategy (as per Texas Holdem rules) is used:

 1. The following order is used to pick the winning player rank, Royal Flush > Straight Flush 
 > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pairs > One Pair > High Card.
 
 2. In case of two players with Royal Flush, they split the win with no tie breaker. 
 E.g. if royal flush shows up on the board.
 
 3. If two players have Straight Flush, then the highest card win. If they have same highest card, 
 then it is a tie.
 
 4. If two players have Straight, then the highest card wins. If they have same highest card, 
 then it is a tie.
 
 5. If two players have Flush, then the highest card wins. If they have same highest card, 
 then it is a tie (no second highest or so on for simplicity).
 
 6. If two players have Full House, the face of three of kind wins tie breaker, followed by face of pair. 
 If both fails, then it is a tie.
  
 7. If two playes have Four of a Kind, then face of four of a kind wins, else the kicker wins. 
 If both fails, then it is a tie. 
 
 8. Three of a kind is better if two of three are from players hand. If both players have same face, 
 then tie is broken based on the kicker.

 9. In case of same Two Pair rank, tie is broken based on the faces of the two pair. 
 If two players have the same
 two pairs, then tie is broken based on the kicker.
 
 10. In case of same One Pair rank, tie is broken based on the face of the pair. 
 If same face for both players,
 then tie is broken based on the kicker. If both fails, then it is a tie.

 11. If two playes have High Card rank, then the kicker is used for breaking tie. 
 If they have same kicker, then it is a tie. 
 
 Kicker is only needed for step 7-11.
*/
static void decideWinner( int num_winner[] )
{
    int i, j, k;
    int winner[MAX_PLAYERS] = {0}; // list of winners
    int win_cand_num;              // num of winners
    unsigned int highest_rank;
    unsigned int highest_card;
    unsigned int highest_kick;
    
    highest_rank = (1 << (NUM_RANKS - High_Card - 1));
    highest_card = 0;
    highest_kick = 0;
    win_cand_num = 0;

    DBG printf("  RANKINGS OF ALL PLAYERS:\n");
    for(i=1; i<num_players; ++i) {
        DBG printf("%s hand has %s with %c as highest card (and kicker is %c).\n",
                players[i].name, rank_list[players[i].rank.rankval], 
                face_symbols[players[i].rank.pair[0]],
                face_symbols[players[i].rank.kicker]);
    }
    
    // Rule to pick winner:
    // 1. Player with highest rank_score wins.
    // 2. If there is a tie in step 1, then player with highest highc_score wins.
    // 3. If there is a tie in step 2, then player with highest kicker wins.
    for(j=0, i=1; i<num_players; ++i) {
        if( players[i].rank.rank_score > highest_rank ) {
            highest_rank = players[i].rank.rank_score;
            j = 0;
            winner[j++] = i;
        }
        else if( players[i].rank.rank_score == highest_rank ) {
            winner[j++] = i;
        }
    }
    win_cand_num = j;
    
    // if win_cand_num > 1, there is a tie, check the highest card
    if( win_cand_num > 1 ) {
        for(k=0, j=0; j<win_cand_num; j++) {
            i = winner[j];        
            if( players[i].rank.high_score > highest_card ) {
                highest_card = players[i].rank.high_score;
                k = 0;
                winner[k++] = i;
            }
            else if( players[i].rank.high_score == highest_card ) {
                winner[k++] = i;
            }
        }
        win_cand_num = k;
    }
    
    // if win_cand_num > 1, there is a tie, check kicker
    if( win_cand_num > 1 ) {
        for(k=0, j=0; j<win_cand_num; j++) {
            i = winner[j];        
            if( players[i].rank.kicker_score > highest_kick ) {
                highest_kick = players[i].rank.kicker_score;
                k = 0;
                winner[k++] = i;
            }
            else if( players[i].rank.kicker_score == highest_kick ) {
                winner[k++] = i;
            }
        }
        win_cand_num = k;
    }
    
    // if win_cand_num > 1, there is a tie, no more tie breaker, split the win 
    DBG printf("\n  THE %2d %s WINNER%s:\n",win_cand_num,(win_cand_num>1)?"JOINT":"",(win_cand_num>1)?"S ARE":" IS");
    for(j=0; j<win_cand_num; j++) {
        i = winner[j];
        DBG printf("%s ",players[i].name);
        DBG printf("with %s, %c as highest card and %c as kicker.\n",
                rank_list[players[i].rank.rankval], 
                face_symbols[players[i].rank.pair[0]],
                face_symbols[players[i].rank.kicker]);
        num_winner[i]++;
    }
    
    DBG printf("\nCongrautlations!!\n");
    
}


#ifdef TESTING
// The test driver
static bool getTestData(int testfaces[], int testsuits[], int testnum)
{
    // this test data assumes num of players = 4 (i.e. 4 hands to rank for each run)
    // any change to number of players would require simlar change to this table
    static char testvec[MAX_NUM_GAMES][TOTAL_NUM_CARDS][3]=
    {/*                               PlayerA (2 cards), PlayerB (2), PlayerC (2), PlayerD (2), Board cards(5)          */
    /*  1. High Card K          PlayerA*/{ "2H","KD",   "2D","4S",   "2S","5H",   "2C","3D",   "7D","8S","9S","TD","QH" },
    /*  2. One Pair 2           PlayerB*/{ "2H","KD",   "2D","2S",   "4S","5H",   "2C","3D",   "7D","8S","9S","TD","QH" },
    /*  3. Two Pairs 3,4        PlayerC*/{ "2H","KD",   "2D","2S",   "4S","3D",   "2C","5H",   "7D","3S","9S","TD","4H" },
    /*  4. Three of a Kind 5    PlayerD*/{ "2H","KD",   "4S","5H",   "2C","3D",   "5D","5S",   "7D","8S","9S","5C","QH" },
    /*  5. Straight 6-10        PlayerA*/{ "6C","TD",   "2H","KD",   "5D","5S",   "4S","5H",   "7D","8S","9S","5C","QH" },
    /*  6. Flush  H             PlayerB*/{ "5D","5S",   "2H","KH",   "4S","5H",   "6C","TD",   "7H","8H","9S","5C","QH" },
    /*  7. Full House 7,8       PlayerC*/{ "4S","7H",   "2H","KD",   "7D","7S",   "2C","3D",   "7C","8S","9S","8C","QH" },
    /*  8. Four of a Kind 9     PlayerD*/{ "2H","KD",   "4S","5H",   "2C","3D",   "9D","9C",   "7D","8S","9S","5C","9H" },
    /*  9. Straight Flush 9-K S PlayerA*/{ "KS","9S",   "2H","KD",   "9D","9C",   "5S","5D",   "TS","JS","QS","5C","5H" },
    /* 10. Royal Flush S        PlayerB*/{ "2H","KD",   "KS","AS",   "9D","9C",   "5S","5D",   "TS","JS","QS","5C","5H" },
    /* 11. One Pair tie Q      PlayerCD*/{ "4S","5H",   "2C","3D",   "QH","QC",   "QD","QS",   "7D","8S","9S","TD","KH" },
    /* 12. High Card tie A   PlayerABCD*/{ "AC","KD",   "AS","4S",   "2S","AH",   "2C","AD",   "7D","8S","9S","TD","QH" },
    };

    if (testnum > MAX_NUM_GAMES-1)
        return false;

    for (int i = 0; i < TOTAL_NUM_CARDS; i++) {

        switch (testvec[testnum][i][0]) {
        case 'A': testfaces[i] = 0;
            break;
        case 'T': testfaces[i] = 9;
            break;
        case 'J': testfaces[i] = 10;
            break;
        case 'Q': testfaces[i] = 11;
            break;
        case 'K': testfaces[i] = 12;
            break;
        default: testfaces[i] = testvec[testnum][i][0] - '1';
            break;
        }
       
        switch (testvec[testnum][i][1]) {
        case 'H': testsuits[i] = 0;
            break;
        case 'S': testsuits[i] = 1;
            break;
        case 'C': testsuits[i] = 2;
            break;
        case 'D': testsuits[i] = 3;
            break;
        }
    }

    return true;
}
#endif /* TESTING */