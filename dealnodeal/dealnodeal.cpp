/********************************************************************
Author: Vikas YADAV (vikasy@gmail.com)
Filename: dealnodeal.cpp
Topic: Implementaton of various methods involved in Deal or No Deal game


***********************************************************************/

/*----------------------------------------------------------------
This file has dealnodeal class definition
-----------------------------------------------------------------*/

/*----------------------------------------------------------------
All includes here
-----------------------------------------------------------------*/
#include "dealnodeal.h"
#include <string>

/*----------------------------------------------------------------
Definition of routines of dealnodeal class
-----------------------------------------------------------------*/

dealnodeal::dealnodeal(void)
:_mode(NONE), _player_case(NUM_CASES+1), _curr_rnd_num(0), _stage(INITIAL), 
_ncase_unopened(NUM_CASES), _curr_avg_unopened(0), _game_num(0)
{
    cout << endl << "~~~WELCOME TO GAME OF DEAL OR NO DEAL~~~" << endl << endl;
    srand(unsigned(time(NULL)));
    // zero out game stats
    _game_stats.avg_amount_won = 0;
    _game_stats.avg_final_round = 0;
    _game_stats.avg_offer_acc = 0;
    _game_stats.best_offer_rej = 0;
    _reset_game();
}

dealnodeal::~dealnodeal(void)
{
    cout << "BYE BYE!!" << endl << endl;
}

void dealnodeal::play_game(mode_t mode_in)
{
    bool       check = false;
    int        select = 0;
    bool       play = true;
    float      prize_money = 0;
    unsigned   count = 0;

    if (mode_in == NONE) {  // get user input
        check = _user_input_to_start();
        while (check == false) {
            cout << "Do you want to retry input:[Enter 1 for Yes]: ";
            cin >> select;
            if (select == 1)
                check = _user_input_to_start();
            if (count++ > 3) {
                play = false;
                break;
            }
        }
        if (_mode == QUIT || _mode == NONE) {
            cout << "QUITTING.. NO PLAY" << endl;
            play = false;
        }
    }
    else { // go with mode provided by testbed
        _mode = mode_in;
    }

    while (play == true) {
        // increment the game numebr
        _game_num++;

        // play one game of Deal or No Deal
        prize_money = _play_a_game();

        // decide if need to play another one
        if (_mode == USER_ONESHOT || _mode == WITH_PC_ONESHOT) {
            play = false;
            cout << endl << "The player selected case had $";
            cout << fixed << _arr_cases[_player_case - 1].money;
            cout << "  vs. the final prize won = " << fixed << prize_money << endl;
        }
        else if (_mode == WITH_PC_MILLION && prize_money == HIGHEST_PRIZE) {
            cout << "WON THE $" << HIGHEST_PRIZE << " PRIZE AFTER " << _game_num << " GAMES." << endl;
            play = false;
        }
        else if (_mode == WITH_PC_ZERO && prize_money <= LOWEST_PRIZE) {
            cout << "GOT THE $" << LOWEST_PRIZE << " PRIZE AFTER " << _game_num << " GAMES." << endl;
            play = false;
        }

        if (play == false) {
            // before exiting, display game statistics
            cout << endl;
            cout << "Total number of games played = " << _game_num << endl;
            cout << "Average amount won = " << int(_game_stats.avg_amount_won) << endl;
            cout << "Average final round = " << _game_stats.avg_final_round << endl;
            cout << "Average offer accepted = " << int(_game_stats.avg_offer_acc) << endl;
            cout << "Best offer rejected= " << int(_game_stats.best_offer_rej) << endl;
            cout << endl;
        }

        _reset_game();
    }

} 

// PRIVATE METHODS
/*
Get user input to start a match, select one-shot interactive or one-shot 
with computer or as many until million or until bankrupt.
Returns false is there in any error in input, else return true
*/
bool dealnodeal::_user_input_to_start(void)
{
    char   select;
    
    // Ask for user input to select between one-shot interactive/not or for-ever modes
    cout << "Enter [S/s] for a user to play interactively,";
    cout << endl << "or [P/p] for computer to play and make decisions, ";
    cout << endl << "or [M/m] to let computer play in background until it wins Million,";
    cout << endl << "or [B/b] to let computer play in background until it get bankrupt";
    cout << endl << "or [Q/q] to quit:";
    cin >> select;

    if (select == 'S' || select == 's') {
        _mode = USER_ONESHOT; // Play interactively with user
    }
    else if (select == 'P' || select == 'p') {
        _mode = WITH_PC_ONESHOT; // Play interactively with PC
    }
    else if (select == 'M' || select == 'm') {
        _mode = WITH_PC_MILLION; // Play noninteractively until million win
    }
    else if (select == 'B' || select == 'b') {
        _mode = WITH_PC_ZERO; // Play noninteractively until gone bankrup
    }
    else if (select == 'Q' || select == 'q') {
        _mode = QUIT; // Quit the game
    }
    else {
        cout << "\nInvalid entry (valid=S/s/P/p/M/m/B/b/Q/q)!" << endl;
        return false;
    }
    return true;
}

/*
Here is a flow of the game:
    [START with 26 cases]
    ROUND #0
    [Player selects a case to be opened last]
    [26 cases remaining ]
    ROUND #1
    [Open 6 cases] --> [20 cases remaining] --> [Bank Offer #1] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #2
    [Open 5 cases] --> [15 cases remaining] --> [Bank Offer #2] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #3
    [Open 4 cases] --> [11 cases remaining] --> [Bank Offer #3] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #4
    [Open 3 cases] --> [ 8 cases remaining] --> [Bank Offer #4] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #5
    [Open 2 cases] --> [ 6 cases remaining] --> [Bank Offer #5] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #6
    [Open 1 case]  --> [ 5 cases remaining] --> [Bank Offer #6] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #7
    [Open 1 case]  --> [ 4 cases remaining] --> [Bank Offer #7] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #8
    [Open 1 case]  --> [ 3 cases remaining] --> [Bank Offer #8] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #9
    [Open 1 case]  --> [ 2 cases remaining] --> [Bank Offer #9] --> [Deal, STOP]
    [No Deal, Go to next round]
    ROUND #10
    [Open the other of the two cases with player selected case remain unopened]
    [Player gets the selected case, STOP]

There are maximum 11 rounds. In general, each round (except round 0 and 10) has 4 steps:
(1) player opens X cases,
(2) bank makes an offer,
(3) player decides Deal or No Deal,
(4) If deal, stop game, player gets offer. Else continue.
*/
float dealnodeal::_play_a_game(void)
{
    bool     decision = no_deal;
    float    offer = 0;
    float    amount_won = 0;

    cout << endl;
    // Init game: Round 0
    _stage = INITIAL;
    cout << *this;
    _init_game();
    if (_player_case == NUM_CASES + 1)
        return 0;

    // Play game: Round 1..9
    for (_curr_rnd_num = 1; _curr_rnd_num <= NUM_OFFERS; ++_curr_rnd_num) {
        _stage = OPEN_CASE;
        cout << *this;
        _open_cases();
        _stage = CALLING_BANKER;
        cout << *this;
        offer = _banker_offer();
        _stage = DEALNODEAL;
        cout << *this;
        decision = _player_decision();
        if (decision == deal)
            break;
        _stage = NODEAL;
        cout << *this;
    }

    // Finish game: Round 10
    _stage = FINAL;
    cout << *this;
    amount_won = _finish_game(decision);
    return amount_won;

}

/*
Shuffle all cases, Player selects a case, and Update game info
*/
void dealnodeal::_init_game(void)
{
    _shuffle_cases();
    _user_input_select_case();
}

/*
Fisher and Yates & Durstenfield method to shuffle monies in cases numbered from 1 to NUM_CASES
*/
void dealnodeal::_shuffle_cases(void)
{
    unsigned i, j;
    float    temp;
    unsigned rand_num;
    rand_num = rand();
    // iterate last case number from 26 to 1
    // pick a case num randomly between 1 and the +last, and swap it with the last case
    for (i = NUM_CASES; i>0; --i) {
        
        j = rand_num%i;
        temp = _arr_cases[i-1].money;
        _arr_cases[i-1].money = _arr_cases[j].money;
        _arr_cases[j].money = temp;
    }
}

/*
Let player select their one million dollar case
*/
void dealnodeal::_user_input_select_case(void)
{
    unsigned select = 0;
    unsigned count = 0;

    cout << endl;
    if (_mode == USER_ONESHOT) {
        while (select < 1 || select > NUM_CASES) {
            cout << "Select your million dollar case: ";
            cin >> select;
            if (select < 1 || select > NUM_CASES)
                cout << "Invalid case number.. select a case number between 1 and " << NUM_CASES << endl;
            if (count++ > 3)
                    return;
        }
    }
    else {
        select = rand();
        select = select%NUM_CASES + 1;
    }
    
    _player_case = select;
    if (_mode == USER_ONESHOT || _mode == WITH_PC_ONESHOT)
        cout << "==========> Player's selected case #" << _player_case << endl;
    _ncase_unopened--;
    _update_avg_money();
    cout << endl;
}

/*
Open a number of unopened cases based on the round number
*/
void dealnodeal::_open_cases(void)
{
    unsigned num_cases_to_open = ncase_to_open[_curr_rnd_num-1];
    unsigned select;
    unsigned i = 0;

    while( i < num_cases_to_open) {
        if (_mode == USER_ONESHOT || _mode == WITH_PC_ONESHOT)
            cout << num_cases_to_open-i << " CASE(S) TO OPEN!" << endl;
        if (_mode == USER_ONESHOT) {
            cout << "Select the case number to open: ";
            cin >> select;
        }
        else {
            select = rand();
            select = select%NUM_CASES + 1;
            while (_arr_cases[select - 1].case_status == 0 || select == _player_case) {
                select = select%NUM_CASES + 1;
            }
        }
        if (select < 1 || select > NUM_CASES 
            || select == _player_case || _arr_cases[select - 1].case_status == 0) {
            cout << "Invalid case number.. select a case number between 1 and " << NUM_CASES << endl;
            continue;
        }
        
        _arr_cases[select-1].case_status = 0;
        if (_mode == USER_ONESHOT || _mode == WITH_PC_ONESHOT) {
            cout << "======>Player's selected case #" << select << " to open" << endl;
            cout << "======>Money in case #" << select;
            cout << " = $" << fixed << setprecision(2) << _arr_cases[select - 1].money << endl;
        }
        _ncase_unopened--;
        for (unsigned j = 0; j < NUM_CASES; ++j) {
            if (case_monies[j] == _arr_cases[select-1].money) {
                _case_status[j] = open;
                break;
            }
        }
        _update_avg_money();
        // display the updated board
        if (_mode == USER_ONESHOT )
            getchar();
        ++i;
        if( i==num_cases_to_open )
            _stage = DONE_OPEN;
        cout << *this;
    }

}

/*
Banker offers a walkaway amount based on current roudn number and 
average amount of money in remaining unopened cases. 
The bankers formula to decide the offer amount depends a random number in between
the brackets corresponding to the current round number.
*/
float dealnodeal::_banker_offer(void)
{
    float left_bracket = bracket[_curr_rnd_num - 1][0];
    float right_bracket = bracket[_curr_rnd_num - 1][1];
    float alpha = float(rand()) / (RAND_MAX+1);
    float fraction = left_bracket + (right_bracket - left_bracket)*alpha;
    float offer = fraction*_curr_avg_unopened;

    _banker_offer_list[_curr_rnd_num - 1] = offer;

    if (_mode == USER_ONESHOT || _mode == WITH_PC_ONESHOT) {
        cout << "Hit enter to continue...";
        getchar();
        cout << "              |-----------------------------------|               " << endl;
        cout << "              |  BANKER'S OFFER IS $" << setw(7) << int(offer) << "       |               " << endl;
        cout << "              |___________________________________|               " << endl;
    }
    return offer;
}

/*
Get player response to bankers offer
*/
bool dealnodeal::_player_decision(void)
{
    char select;

    if (_mode == USER_ONESHOT) {
        cout << endl << "    DEAL   OR   NO   DEAL  ? [Y/y/N/n] : ";
        cin >> select;
        getchar();
        if (select != 'Y' && select != 'y') {
            cout << endl << "    == NO DEAL!" << endl << endl;
            return no_deal;
        }
        else {
            cout << endl << "YEAH!!!  DEAL  !!!!!!!!!!!" << endl << endl;
            return deal;
        }
    }
    else  if (_mode == WITH_PC_ONESHOT) {
        if (_banker_offer_list[_curr_rnd_num - 1] < 0.70*_curr_avg_unopened) {
            cout << "NO DEAL!" << endl;
            return no_deal;
        }
        else {
            cout << "DEAL" << endl;
            return deal;
        }
    }
    else // else in forever game, always reject banker's offer
        return no_deal;
}

/*
Update game data for moves so far
*/
void dealnodeal::_update_avg_money(void)
{
    _curr_avg_unopened = 0;
    // Update avg money left
    for (unsigned i = 0; i < NUM_CASES; ++i) {
        _curr_avg_unopened += _arr_cases[i].case_status * _arr_cases[i].money;
    }
    _curr_avg_unopened /= _ncase_unopened;
}

/* 
The last step of the game after either DEAL is made or no more cases left to open
*/
float dealnodeal::_finish_game(bool decision)
{
    float amount_won = 0;
    
    _update_avg_money();

    // update game stats
    _game_stats.avg_final_round = _game_stats.avg_final_round * (_game_num - 1) + _curr_rnd_num;
    _game_stats.avg_final_round = _game_stats.avg_final_round / _game_num;
    
    for (unsigned i = 0; i < _curr_rnd_num-1; ++i) {
        if( _banker_offer_list[i] > _game_stats.best_offer_rej )
            _game_stats.best_offer_rej = _banker_offer_list[i];
    }

    if (decision == deal) {
        amount_won = _banker_offer_list[_curr_rnd_num - 1];
        _game_stats.avg_offer_acc = _game_stats.avg_offer_acc * (_game_num - 1) + amount_won;
        _game_stats.avg_offer_acc = _game_stats.avg_offer_acc / _game_num;
    }
    else
        amount_won = _arr_cases[_player_case-1].money;
    
    _game_stats.avg_amount_won = _game_stats.avg_amount_won * (_game_num - 1) + amount_won;
    _game_stats.avg_amount_won = _game_stats.avg_amount_won / _game_num;

    if (_mode == USER_ONESHOT || _mode == WITH_PC_ONESHOT) {
        cout << endl << "~~CONGRATULATIONS~~" << endl;
        cout << "YOU WON $" << setprecision(2) << amount_won;
        cout << " AFTER ROUND " << _curr_rnd_num << endl;
        cout << endl << "Hit enter to continue...";
        getchar();
    }
    return amount_won;

}

/*
Reset game to start fresh
*/
void dealnodeal::_reset_game(void)
{
    for (unsigned i = 0; i < NUM_CASES; ++i) {
        _arr_cases[i].money = case_monies[i];
        _arr_cases[i].case_status = _case_status[i] = 1; // 1 = close, 0=open
    }
    for (unsigned i = 0; i < NUM_OFFERS; ++i)
        _banker_offer_list[i] = 0;
    _ncase_unopened = NUM_CASES;
    _curr_rnd_num = 0;
}

/*
 List of header messages based on the stage of a round
 0. Select a million dollar case!
 1. Open N cases: 1 to N
 2. OK. Calling Banker...
 3. Banker offer $
 4. Deal or No Deal?
 */
char * dealnodeal::_get_header_info(void) const
{
    switch (_stage) {
    case INITIAL:
        return "      SELECT YOUR MILLION DOLLAR CASE!";
    case OPEN_CASE:
        return "          OPENING CASES ... ";
    case DONE_OPEN:
        return "     DONE OPENING CASES FOR THIS ROUND";
    case CALLING_BANKER:
        return "     RING RING... CALLING MR. BANKER...";
    case DEALNODEAL:
        return "            DEAL OR NO DEAL?";
    case NODEAL:
        return "            NO DEAL!!!";
    case FINAL:
        return "            !! YOU WON !!";
    default:
        return "DONT KNOW";
    }
}



// FRIEND METHOD 
ostream& operator<<(ostream& o, const dealnodeal& DnD)
{
    unsigned  i, j, k;
    char     *header;
    char     dd[3] = { ' ',' ',0 };
    char      c, U;

    if (DnD._mode == WITH_PC_MILLION || DnD._mode == WITH_PC_ZERO)
        return o;

    cout << "Hit enter to continue...";
    getchar();
    //getchar();
    //system("cls");
    cout << endl;

    header = DnD._get_header_info();

    // FIRST LINE
    if (DnD._player_case <= NUM_CASES)
        cout << "!!!Player selected case is #" << DnD._player_case;
    cout << "                        ROUND #" << DnD._curr_rnd_num << endl;
    cout << "|------------------------------------------------------------------|" << endl;
    cout << "|           " << header << string(55 - strlen(header), ' ') << "|" << endl;
    cout << "|------------------------------------------------------------------|" << endl;

    // ROW 1
    i = 0; j = 13; k = 0;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$0.01" << string(5, c) << "|" << string(35, '-');
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "|" << string(4, c) << "$1,000" << string(4, c) << "|" << endl;

    // ROW 2
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(6, c) << "$1" << string(7, c) << "| ";
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "  " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "| " << U << dd << U;
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "    |" << string(4, c) << "$5,000" << string(4, c) << "|" << endl;

    // ROW 3
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(6, c) << "$5" << string(7, c) << "|" << string(35, '-');
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "|" << string(3, c) << "$10,000" << string(4, c) << "|" << endl;

    // ROW 4
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$10" << string(7, c) << "| ";
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "  " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd + 1, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "    |" << string(3, c) << "$25,000" << string(4, c) << "|" << endl;

    // ROW 5
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$25" << string(7, c) << "|" << string(35, '-');
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "|" << string(3, c) << "$50,000" << string(4, c) << "|" << endl;

    // ROW 6
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$50" << string(7, c) << "| ";
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "  " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "    |" << string(3, c) << "$75,000" << string(4, c) << "|" << endl;

    // ROW 7
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$75" << string(7, c) << "|" << string(35, '-');
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "|" << string(3, c) << "$100,000" << string(3, c) << "|" << endl;

    // ROW 8
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$100" << string(6, c) << "| ";
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "  " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "    |" << string(3, c) << "$200,000" << string(3, c) << "|" << endl;

    // ROW 9
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$200" << string(6, c) << "|" << string(35, '-');
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "|" << string(3, c) << "$300,000" << string(3, c) << "|" << endl;

    // ROW 10
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$300" << string(6, c) << "| ";
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "  " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "    |" << string(3, c) << "$400,000" << string(3, c) << "|" << endl;

    // ROW 11
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$400" << string(6, c) << "|" << string(35, '-');
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "|" << string(3, c) << "$500,000" << string(3, c) << "|" << endl;

    // ROW 12
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$500" << string(6, c) << "| ";
    cout << "            ";
    k++;
    U = (DnD._player_case == k) ? '*' : ' ';
    if (DnD._arr_cases[k - 1].case_status == open) {
        *dd = *(dd + 1) = ' '; *(dd + 2) = 0;
    }
    else
        itoa(k, dd, 10);
    cout << "| " << U << dd << U;
    cout << "|           ";
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "    |" << string(3, c) << "$750,000" << string(3, c) << "|" << endl;

    // ROW 13
    i++; j++;
    c = (DnD._case_status[i] == open) ? 'X' : ' ';
    cout << "|" << string(5, c) << "$750" << string(6, c) << "|" << string(35, '-');
    c = (DnD._case_status[j] == open) ? 'X' : ' ';
    cout << "|" << string(2, c) << "$1,000,000" << string(2, c) << "|" << endl;
    cout << "|_______________|___________________________________|______________|" << endl;
    cout << "|________D___E___A___L____O___R____N___O____D___E___A___L__________|" << endl;

    // LAST LINE

    cout << "Previous offers: ";
    for (i = 0; i < NUM_OFFERS; ++i) {
        if (DnD._banker_offer_list[i] == 0)
            break;
        if (i == 5) cout << endl;
        cout << "$" << int(DnD._banker_offer_list[i]) << "  ";
    }
    cout << endl;
    cout << "|__________________________________________________________________|" << endl;

    return o;

}
