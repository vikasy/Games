/********************************************************************
Author: Vikas YADAV (vikasy@gmail.com)
Filename: dealnodeal.h
Topic: Declaration of various methods involved in Deal or No Deal game


***********************************************************************/

/*----------------------------------------------------------------
This file has dealnodeal class declaration
-----------------------------------------------------------------*/

/*----------------------------------------------------------------
All includes here
-----------------------------------------------------------------*/

#ifndef __DEALNODEAL_H__
#define __DEALNODEAL_H__

#include "../util/util.h"

#define HIGHEST_PRIZE (1000000)
#define LOWEST_PRIZE  (0.01)
#define NUM_ROUNDS    (11)
#define NUM_OFFERS    (NUM_ROUNDS-2)
#define NUM_CASES     (26)
#define no_deal       (false)
#define deal          (true)
#define open          (0)

// various ways to play the game
typedef enum {
    NONE = 0,
    WITH_PC_ONESHOT, // non-interactive, one-shot
    WITH_PC_MILLION, // non-interactive, till million dollars won
    WITH_PC_ZERO, // non-interactive, till go bankrupt
    USER_ONESHOT, // interactive with a user, one-shot
    QUIT
} mode_t;

// various stages in a round of game
typedef enum {
    INITIAL,
    OPEN_CASE,
    DONE_OPEN,
    CALLING_BANKER,
    BANKER_OFFER,
    DEALNODEAL,
    NODEAL,
    FINAL
} stage_t;

// a briefcase type, id is obtained by its position in array of cases
typedef struct {
    float  money;
    int    case_status;  // 0 if opened and 1 if unopened
    //bool   players_case; // indicate if this case is picked by player
} case_t;

// game average stats
typedef struct {
    unsigned avg_final_round;
    float     best_offer_rej;
    float     avg_offer_acc;
    float     avg_amount_won;
} stats_t;

const static float case_monies[NUM_CASES] = { 0.01f, 1.0f, 5.0f, 10.0f, 25.0f, 50.0f, 75.0f,
100.0f, 200.0f, 300.0f, 400.0f, 500.0f, 750.0f, 1000.0f, 5000.0f, 10000.0f, 25000.0f, 
50000.0f, 75000.0f, 100000.0f, 200000.0f, 300000.0f, 400000.0f, 500000.0f, 750000.0f, 1000000.0f };

// the bankers formula to decide offer amount depends a random number in between 
// the bracket corresponding to the current round number and the current avg value 
// of unopened boxes
const static float bracket[NUM_OFFERS][2] = {   
                                    { 0.10f, 0.25f },  // ROUND 1
                                    { 0.20f, 0.35f },  // ROUND 2
                                    { 0.20f, 0.35f },  // ROUND 3
                                    { 0.20f, 0.35f },  // ROUND 4
                                    { 0.30f, 0.45f },  // ROUND 5
                                    { 0.40f, 0.55f },  // ROUND 6
                                    { 0.50f, 0.65f },  // ROUND 7
                                    { 0.60f, 0.75f },  // ROUND 8
                                    { 0.70f, 0.85f } };// ROUND 9

// number of cases to open based on the round number
const static unsigned ncase_to_open[NUM_ROUNDS-1] = 
                                    { 6, 5, 4, 3, 2, 1, 1, 1, 1, 1 };

// Class definition for Deal No Deal game
class dealnodeal {
    public:
        dealnodeal(void); // constructor
        ~dealnodeal(void); // destructor
        void play_game(mode_t mode = NONE); // play a game of deal or no deal
    
    friend ostream& operator<<(ostream& o, const dealnodeal& d); // display board

    private:
        // DATA
        mode_t   _mode; // interactively or not, oneshot or til million/zero
        case_t   _arr_cases[NUM_CASES]; // pos in array is the number of case
        float    _banker_offer_list[NUM_OFFERS]; // list of all banker offers
        int      _case_status[NUM_CASES]; // open or not, cases are ordered in terms of money value
        stats_t  _game_stats; // game stats avg values over all games
        stage_t  _stage; // curr stage of curr round 
        unsigned _player_case; // player's case number
        unsigned _curr_rnd_num; // currnet round number
        unsigned _ncase_unopened; // number of unopened cases yet
        float    _curr_avg_unopened; // avg value of unopened cases
        unsigned _game_num; // number of the iteraton of game play
        // METHODS
        bool     _user_input_to_start(void); // to play interactively or not, oneshot or not
        float    _play_a_game(void); // play a game of deal no deal
        void     _init_game(void);   // player picks a case to start with
        void     _shuffle_cases(void); // shuffle all cases at start of the game
        void     _user_input_select_case(void); // user picks his/her case
        void     _open_cases(void);  // player opens a number of cases based on round
        float    _banker_offer(void); // banker offer for player to walk away
        bool     _player_decision(void); // player decision, deal or no deal?
        void     _update_avg_money(void); // update game data so far
        float    _finish_game(bool decision); // the last step of the game
        void     _reset_game(void);  // reset game to play another one
        char*    _get_header_info(void) const;
};

#endif  /* __DEALNODEAL_H__ */
//EOF


