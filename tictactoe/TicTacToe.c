/********************************************************************
  Author: Vikas YADAV (vikasy@gmail.com)
  Filename: TicTacToe.c
  Topic: Tic tac toe board game with other user or with computer
   
  Objective: Implement Tic Tac Toe, where a user can play against 
  another user or against the program itself. Basic rules of TicTacToe
  are: 
  1. Tic Tac Toe is an NxN square (2-dim) array of boxes(cells) to be 
  filled during the play
  2. Two players game, playing alternatively by putting their mark on one
  of the empty box
  3. The player starting the first move plays with Xs and other with Os.
  4. The first player to get all Ns in a row or column or top to bottom 
  diagonal (minor diag) or bottom to top diagonal (major diag) WINS.
  5. The game ends in a DRAW if no players win and there is no empty box 
  to play

  An example of a 4x4 TicTacToe with user playing X (first user) winning 
  by getting all 4 Xs in top to bottom diagnoal (minor diag). 
        1     2     3     4
     *************************
   1 *  X  |  O  |  O  |  O  *
     *-----------------------*
   2 *  O  |  X  |  X  |  X  *
     *-----------------------*
   3 *  O  |  O  |  X  |  X  *
     *-----------------------*
   4 *  O  |  O  |  X  |  X  *
     *************************

  Input: User input (1) to select between single player or multiplayer
  Singles player is Player A vs computer aka T3 (aka Player B)
  and Multiplayer is between Player A and Player B, two users.
  Toss selects who plays first move.
  Players make their move by entering a row number and a column 
  number of the selected cell.
  
  NOTE:  None

********************************************************************/

#include <stdio.h>
#include <stdlib.h>
#include <process.h>
#include <stdbool.h>
#include <time.h>


#ifndef DIM  // can define from outside via build option as well
#define DIM     ( 5 ) // Dimension of the game (DIMxDIM)
#endif

#define MAX_MOV ( (DIM*DIM)/2 + 1 )

// Typedefs for this game
typedef enum {
    NONE = 0,
    WINA,
    WINB,
    DRAW
} result_t;

typedef enum {
    SINGLE = 0,
    MULTIPLAYER
} playmode_t;

typedef enum {
    None = 0,
    PlayerA,
    PlayerB
} player_t;

enum {
    ROW = 0,
    COL
} dim;


// store individual moves in the following two arrays
static int  moves_PlayerA[MAX_MOV][2] = {0};
static int  moves_PlayerB[MAX_MOV][2] = {0};
// store all moves played by both players in one 2-dim matrix
static char moves_tab[DIM][DIM] = {0};

// static gloabl variables, statistics of play history
static int match_num = 0;
static int num_draw = 0;
static int num_wina = 0;
static int num_winb = 0;
static int toss_a = 0;
static int toss_b = 0;

// static gloabl variables, state of a game
static player_t     firstone;
static playmode_t   mode;

// FUNCTION PROTYPES
// Get user input to start a match
// select single vs double, also perform the toss to find who plays first
// returns false is there in any error in input, else return true
static bool user_input_to_start( void );

// Check if move specified by rownum and colnum results
// in a win for a specified player
static result_t check_for_a_win(int rownum, int colnum, player_t player );

// Check board to see if any player won or if it is full (draw)
// returns NONE if none of the above, else returns WINA if player 
// A has won, or WINB if player B has won or else returns DRAW
static result_t check_board_state( int mov_index, player_t player );

// Draw the current state of the board for players to make next move
// Use a list of past moves of each players to draw the board
static void draw_current_board( int mov_index, player_t player );

// Player makes the next move
static result_t make_a_move( int mov_index, player_t player );

// User makes the next move
static int get_user_move( int *prow, int *pcol, player_t player );

// PC (aka T3) makes the next move
static bool get_t3_move( int *prow, int *pcol );

// find winning move for self or opponent
static bool find_a_win_move( int *prow, int *pcol, int self );

// find fork move for self or opponent
static bool find_a_fork_move( int *prow, int *pcol, int self );

// Check center, cornern, or side, in the order listed
static bool find_a_good_move( int *prow, int *pcol, int self );

// Check center, cornern, or side, in the order listed
static bool find_a_move( int *prow, int *pcol );

// Get function to obtain firstplayer label
// this should be only way to access firstone
static player_t get_firstplayer( void );

// Get function to obtain play mode (single, multiple) label
// this should be only way to access model
static playmode_t get_playmode( void );


// Main entry point
int main( void )
{
    player_t     player_turn;
    result_t     result;
    int          mov_idx = 0;
    bool         user_in_flag = false;
    int          cont;
    char         select;
    
    // clear screen
    system("cls");
    printf("\n    Lets play TIC TAC TOE!!\n\n");
    
    // Play multiple matches
    do {
        // Get user inpout to start a match
        user_in_flag = user_input_to_start();
        if( user_in_flag == false ) return -1;
        // else increment match number
        else {
            match_num++;
            mov_idx = 0;
        }
        // set the first player, first player uses X marker
        player_turn = get_firstplayer();

        // Draw first clean board
        draw_current_board( mov_idx, player_turn );
                
        // Play the game
        do {
            // inc mov index once after both player have played their turns
            if( player_turn == get_firstplayer() ) mov_idx++;
            
            // Player in turn to play
            result = make_a_move(mov_idx, player_turn);
            if(result != NONE ) break;
     
            // Check board status before moving to next turn
            result = check_board_state(mov_idx, player_turn);
            
            // select next player to play
            player_turn = (player_turn == PlayerA)? PlayerB: PlayerA;
            
            // Draw the updated board
            draw_current_board(mov_idx, player_turn);
        
        } while( result == NONE );
                  
        // Display the outcome
        switch( result ) {
            case WINA:
                num_wina++;
                printf("\nPlayer A WINS after %d move(s). Congrats A!\n",mov_idx);
                break;
            case WINB:
                num_winb++;
                printf("\nPlayer B WINS after %d move(s). Congrats B!\n",mov_idx);
                break;
            case DRAW:
                num_draw++;
                printf("\nIts a DRAW. Enjoy!\n");
                break;
            default:
                printf("\nERR:Should not reach here!!\n");
        }
        
        // Print history data
        printf("\nPlayer A vs Player B History::\n");
        printf("              WON    LOSS   DRAW   TOSS\n");
        printf("Player A:   %3d     %3d    %3d    %3d\n", num_wina, num_winb, num_draw, toss_a );
        printf("Player B:   %3d     %3d    %3d    %3d\n", num_winb, num_wina, num_draw, toss_b );
                
                
        // Check players if they want to play again:
        cont = 1;
        printf("\nDo you want to play once more [Y/N]:");
        select = getchar(); // eat the prev null char in buffer
        select = getchar(); // user input
        if( select != 'Y' && select != 'y' && select != 'N' && select != 'n' ) {
            printf("\nInvalid entry (valid=Y/y/N/n), Exiting!\n");
            cont = 0;
        }
        if( select == 'N' || select == 'n' ) cont = 0, printf("\nBye!\n");
        select = getchar(); // eat the null char
        
    } while( cont == 1 );
    
    return 0;
    
}


// Get user input to start a match
// select single vs double, also perform the toss to find who plays first
// returns false is there in any error in input, else return true
static bool user_input_to_start(void)
{
    char   select;
    int    toss;
    int    i, j;
        
    // Ask for user input to select between single player and multiplayer
    printf("Enter S/s for Single Player (vs PC) or M/m for Multiplayer (two users) or Q/q to quit:");
    if( scanf("%c",&select)!=1 
          || (select != 'S' && select != 's' && select != 'M' && select != 'm') ) {
        printf("\nInvalid entry (valid=S/s/M/m), Exiting!\n");
        return false; 
    }
    else if( select == 'S' || select == 's' ) {
        mode = SINGLE; // Play against program T3
    }
    else {
        mode = MULTIPLAYER; // Play with another user
    }
    scanf("%c",&select); // eat the null from prev input
    
    // Toss to decide who plays first
    printf("Toss Time: Player A, please choose H for head or T for tail:");
    if( scanf("%c",&select)!=1 
          || (select != 'H' && select != 'h' && select != 'T' && select != 't') ) {
        printf("\nInvalid entry (valid=H/h/T/t), Exiting!\n");
        return false; 
    }
    
    srand((unsigned int)time(0));
    toss = rand()%2;
    //printf("%d\n",toss);
    if( select == 'H' || select == 'h' ) {
        firstone = (toss == 0)? PlayerB: PlayerA;
    }
    else {
        firstone = (toss == 0)? PlayerA: PlayerB;
    }
    if( firstone == PlayerA ) {
        toss_a++;
        printf("\nPlayer A has won the toss\n");
    }
    else {
        toss_b++;
        printf("\nPlayer B has won the toss\n");
    }
    scanf("%c",&select); // eat the null from prev input
    printf("Hit Enter to continue...\n");
    select = getchar();
    
    // reset player moves list and moves 2d table
    for( i=0; i<MAX_MOV; i++ ) {
        moves_PlayerA[i][0] = 0;
        moves_PlayerA[i][1] = 0;
        moves_PlayerB[i][0] = 0;
        moves_PlayerB[i][1] = 0;
    }
    for( i=0; i<DIM; i++)
        for( j=0; j<DIM; j++)
            moves_tab[i][j] = 0;
    
    return true;
}


// Check if move specified by rownum and colnum results
// in a win for a specified player
static result_t check_for_a_win(int rownum, int colnum, player_t player)
{
    int      i;
    char     mark;
    
    // select X or O for matching marker
    mark = (player == get_firstplayer()) ? 'X': 'O';

    // check for row win
    for( i=0; i<DIM; i++) 
        if( mark != moves_tab[rownum][i] ) break;
    if( i== DIM ) {
        return (player == PlayerA) ? WINA: WINB;
    }
    
    // check for column win
    for( i=0; i<DIM; i++) 
        if( mark != moves_tab[i][colnum]) break;
    if( i== DIM ) {
        return (player == PlayerA) ? WINA: WINB;
    }
    
    // check for major diag win
    if( rownum == colnum ) {
        for( i=0; i<DIM; i++) 
            if( mark != moves_tab[i][i]) break;
    }
    if( i== DIM ) {
        return (player == PlayerA) ? WINA: WINB;
    }
    
    // check for minor diag win
    if( rownum + colnum == DIM-1 ) {
        for( i=0; i<DIM; i++) 
            if( mark != moves_tab[i][DIM-1-i]) break;
    }
    if( i== DIM ) {
        return (player == PlayerA) ? WINA: WINB;
    }
    
    return NONE;
    
}


// Check board to see if specified player won or if it is draw
// returns NONE if none of the above, else returns WINA if player 
// A has won, or WINB if player B has won or else returns DRAW
static result_t check_board_state( int mov_index, player_t player)
{
    int      rownum;
    int      colnum;
    int      (*player_moves)[2];
    result_t retval;
    
    static int prev_mov_index;
    
    // select player move record to use for printing the board
    player_moves = (player == PlayerA) ? moves_PlayerA: moves_PlayerB;   
    if( mov_index > 0 ) {
        rownum = player_moves[mov_index-1][ROW]-1;
        colnum = player_moves[mov_index-1][COL]-1;
    }
    
    retval = check_for_a_win(rownum, colnum, player);
    if( retval != NONE ) return retval;
    
    // else if moves are over, return a draw
    if( DIM%2 == 0 && mov_index == DIM*DIM/2 && prev_mov_index == mov_index ) {
        return DRAW;
    }
    else if( mov_index == DIM*DIM/2 + 1 ) {
        return DRAW;
    }

    prev_mov_index = mov_index;
    // else return None
    return NONE;

}

// Draw the current state of the board for players to make next move
// Use a list of past moves of each players to draw the board
// For example:
//        1     2     3     4     5
//     ************************************
//   1 *  X  |  O  |  O  |  O  |          |
//     *--------------------------      ---
//   2 *  O  |  X  |  X  |  X  |          |
//     *--------------------------      ---
//   3 *  O  |  O  |  X  |  X  |          |
//     *--------------------------      ---
//   4 *  O  |  O  |  X  |  X  |          |
//     *--------------------------      ---
//   5 * 
//     *                                  |
//     *     |     |     |     |          |
//     *-----------------------------------
//
// Also shows all the moves played by both players till now
// along with a asterisk mark indicating the player who turn is on
// 
static void draw_current_board( int mov_index, player_t player)
{
    static int num_lines = 2*(DIM+1);
        
    // local vars
    int   i, j;
    
    // clear screen to show only updated board after the latest move 
    //system("cls"); // remove this line to show boards for all previous moves
    
    printf("\nThe board after %d move(s):\n\n", mov_index);
    printf("  [Match #%d] Player A vs. Player B", match_num);
    printf("  >>Player %c ('X') won the toss.\n",(PlayerA==get_firstplayer())?'A':'B');
    
    // print first two lines, one cell at a time
    printf("\n      ");
    for( i=1; i<(DIM+1); i++ ) 
        printf("%4d  ",i);
    printf("\n     *");
    for( i=1; i<(DIM+1); i++ ) 
        printf("******");

    // print remaining lines, one cell at a time
    // using info from "moves_tab" matrix
    for( j=2; j<num_lines; j=j+2 ) {
        printf("\n%4d *",j/2);
        for( i=1; i<(DIM+1); i++ ) 
            printf("  %c  |",moves_tab[j/2-1][i-1]);
        printf("\b*\n     *");
        for( i=1; i<(DIM+1); i++ ) 
            printf("------");
    }
    // overwrite the last line with all asterisk
    printf("\r     *");
    for( i=1; i<(DIM+1); i++ ) 
        printf("******");
    printf("\n\n");
    
    // Print players moves:
    printf("\n  Players moves (row,col) upto %d move(s)", mov_index);
    printf("\n  Player A%c: ", (player==PlayerA)? '*': ' ' );
    for( i=0; i<MAX_MOV && moves_PlayerA[i][0]!=0; i++ ) {
        printf("(%2d,%2d)",moves_PlayerA[i][0],moves_PlayerA[i][1]);
        if( i%10==9 ) printf("\n             ");
    }
    printf("\n  Player B%c: ", (player==PlayerB)? '*': ' ');
    for( i=0; i<MAX_MOV && moves_PlayerB[i][0]!=0; i++ ) {
        printf("(%2d,%2d)",moves_PlayerB[i][0],moves_PlayerB[i][1]);
        if( i%10==9 ) printf("\n             ");
    }
    printf("\n\n");

    return;
    
}


// Player makes the next move
// If mode is MULTIPLAYER player, both players are external user
// If mode is SINGLE player, one player is external user and 
// other player is the computer
static result_t make_a_move( int mov_index, player_t player)
{
    int  (*player_moves)[2];
    int   row, col;
    int   try_left;
    char  player_label;
    char  mark;
    
    // select player move record to use for priting the board
    player_moves = (player == PlayerA) ? moves_PlayerA: moves_PlayerB;
    
    player_label = (player==PlayerA)?'A':'B';
    
    mark = (player == get_firstplayer()) ? 'X': 'O';
    
    if( player_label == 'B' && SINGLE == get_playmode() ){
        // second player's turn, and that player is T3
        printf("\nPlayer B (Computer)'s turn\n");
        get_t3_move(&row, &col);
        printf("Player B's move: %d %d\n",row,col);
        //system("Sleep(1000)"); // sleep for one sec to let user see the response
    }
    else {
        // get user input move from keyboar input
        try_left = get_user_move(&row, &col, player);
        if( try_left == 0) {
           //printf("\nPlayer %c WINS after %d move(s). Congrats %c!\n", player_label, mov_index, player_label);
           return (player==PlayerA)?WINB:WINA;
        }
    }

    // save move in player's move list and moves 2d table
    if( mov_index > 0 ) {
        player_moves[mov_index-1][ROW] = row;
        player_moves[mov_index-1][COL] = col;
        moves_tab[row-1][col-1] = mark;
    }
    
    return NONE;
}


// User makes the next move through keyboard input
// Maximum five attempts are allowed in case of invalid input
// If no valid input in max tries, user looses the game
static int get_user_move( int *prow, int *pcol, player_t player )
{
    int   max_try = 5;
    char  mark, player_label;
    char  ch;
    
    mark = (player == get_firstplayer())?'X':'O';
    player_label = (player==PlayerA)?'A':'B';    
    
    // Ask player to enter their move
    do {
        printf("Player %c [%c], ENTER your move (row,col) or Q/q to quit:", player_label, mark);
        if( scanf("%d %d",prow, pcol)!=2 || *prow > DIM || *pcol > DIM ) {
            if( scanf("%c",&ch) == 1 && (ch == 'q' || ch == 'Q') ) return 0;
            printf("\nInvalid entry. Enter row and col numbers as shown on the board.\n");
            scanf("%*[^\n]"); // flush stdin in case of invalid input
        }
        else if( moves_tab[*prow-1][*pcol-1] != 0 ) {
            printf("\nInvalid entry. Cell [%d,%d] is already full.\n",*prow,*pcol);
        }
        else {
            break;
        }
    } while ( --max_try && printf("Retry(%d left)\n",max_try-1) );

    return max_try;
}

// Computer (aka T3) makes the next move
//
// Basic strategy: A player at his/her turn must check to see if can win 
// during this turn, if yes, must make that move, else check if the opponent 
// can win in the next turn, if yes, must play a move to block that win.
// Else the player can make the "best" move.
//
// Here we use Newell and Simon's 1972 tic-tac-toe rules (Wikipedia)
// Win: If the player has two in a row, they can place a third to get three in a row.
// Block: Else If the opponent has two in a row, the player must play the third themselves
//    to block the opponent.
// Fork: Else Create an opportunity where the player has two threats to win 
//    (two non-blocked lines of 2).
// Blocking an opponent's fork: Else block opponent's chance to fork
//     Option 1: The player should create two in a row to force the opponent into 
//     defending, as long as it doesn't result in them creating a fork. For example, 
//     if "X" has two opposite corners and "O" has the center, "O" must not play a 
//     corner in order to win. (Playing a corner in this scenario creates a fork for "X" to win.)
//     Option 2: If there is a configuration where the opponent can fork, the player should block that fork.
// If none of the above, then:
// Center: A player marks the center. (If it is the first move of the game, playing on a corner gives the 
//     second player more opportunities to make a mistake and may therefore be the better choice; however, 
//     it makes no difference between perfect players.)
// Opposite corner: If the opponent is in the corner, the player plays the opposite corner.
// Empty corner: The player plays in a corner square.
// Empty side: The player plays in a middle square on any of the 4 sides.
// First available move: Lastly, pick the first available empty spot.
// 
static bool get_t3_move( int *prow, int *pcol )
{
    bool found = false;
    int  row, col;
    
    // find winning move for self or opponent
    found = find_a_win_move( &row, &col, 1 );
    if( !found ) found = find_a_win_move( &row, &col, 0 );
    
    // find fork move for self or opponent
    if( !found ) found = find_a_fork_move( &row, &col, 1 );
    if( !found ) found = find_a_fork_move( &row, &col, 0 );
    
    // Check center, cornern, or side, in the order listed
    if( !found ) found = find_a_good_move( &row, &col, 1 );
    
    // if none of the abvoe, just find a valid move for self
    if( !found ) found = find_a_move( &row, &col );
    
    if( found ) *prow = row, *pcol = col;
    
    return found;
}


// Find winning move for self or opponent
// Check every empty spot to see if playing there wins or not
static bool find_a_win_move( int *prow, int *pcol, int self )
{
    char     mark;
    int      i, j;
    result_t retval;

    mark = ((self?PlayerB:PlayerA) == get_firstplayer())?'X':'O';

    // check all empty boxes in the board
    for( i=0; i<DIM; i++) {
        for( j=0; j<DIM; j++) {
            if( moves_tab[i][j] == 0 ) {
                moves_tab[i][j] = mark;
                retval = check_for_a_win(i, j, (self?PlayerB:PlayerA) );
                moves_tab[i][j] = 0;
                if( retval == (self?WINB:WINA) ) {
                    // there is a winning move
                    *prow = i+1;
                    *pcol = j+1;
                    // note: row and col num start from 1, 
                    // while array indices start from 0
                    return true;
                }
            }
        }
    }
    
    return false;

}

    
// Find fork move for self or opponent, uses backtracking scheme.
// fork move is one which creates two opportunities to win in the next move
// THIS IS THE ONLY COMPLICATED PART , total number of checks = DIM^4 max
static bool find_a_fork_move( int *prow, int *pcol, int self )
{
    char     mark;
    int      i, j;
    result_t retval;
    bool     first_empty_found = false;
    int      count = 0;
    
    mark = ((self?PlayerB:PlayerA) == get_firstplayer())?'X':'O';

    // check all empty boxes in the board
    j = 0;
    for( i=0; i<DIM; i++) {
        for( ; j<DIM; j++) {
            if( moves_tab[i][j] == 0 ) {
                // empty box, if we play here, does it create a fork?
                moves_tab[i][j] = mark;
                if( !first_empty_found ) {
                    *prow = i+1;
                    *pcol = j+1;
                    first_empty_found = true;
                    // reset indeces to scan all empty boxes
                    i = 0;
                    j = -1;
                    continue; // to find next empty box from the begining
                }
                retval = check_for_a_win(i, j, (self?PlayerB:PlayerA) );
                moves_tab[i][j] = 0; // ready to backtrack
                if( retval == (self?WINB:WINA) ) count++;
                if( count == 2 ) {
                    // there is a fork!
                    moves_tab[*prow-1][*pcol-1] = 0; 
                    return true;
                }
            }
        }
        j = 0;
        if( i==DIM-1 && first_empty_found ) {
            // there is no fork found, check for other empty box
            i = *prow-2;
            j = (*pcol)%DIM;
            if(j==0) i++;
            moves_tab[*prow-1][*pcol-1] = 0; 
            first_empty_found = false;
            count = 0;
        }
    }
    

    return false;

}


// Check center, corner, or side, in the order listed
// this is used if there is no winning or fork move available
static bool find_a_good_move( int *prow, int *pcol, int self )
{
    int  i, j;
    char opp_mark;

    // get opponent's mark
    opp_mark = ((self?PlayerB:PlayerA) == get_firstplayer())?'O':'X';
    
    // find a center spot if free
    if( moves_tab[DIM/2][DIM/2] == 0 ) {
        *prow = DIM/2 + 1;
        *pcol = DIM/2 + 1;
        return true;
    }
    else if( DIM%2 == 0 ) {
        if( moves_tab[DIM/2-1][DIM/2] == 0 ) {
            *prow = DIM/2;
            *pcol = DIM/2 + 1;
            return true;
        }
        else if( moves_tab[DIM/2][DIM/2-1] == 0 ) {
            *prow = DIM/2 + 1;
            *pcol = DIM/2;
            return true;
        }
        else if( moves_tab[DIM/2-1][DIM/2-1] == 0 ) {
            *prow = DIM/2;
            *pcol = DIM/2;
            return true;
        }
    }
    
    // check corners for opponent, to play opposite corner, if free
    if( moves_tab[0][0] == opp_mark && moves_tab[DIM-1][DIM-1]  == 0 ) {
        *prow = DIM;
        *pcol = DIM;
        return true;
    }
    else if( moves_tab[0][DIM-1] == opp_mark && moves_tab[DIM-1][0] == 0 ) {
        *prow = DIM;
        *pcol = 1;
        return true;
    }
    else if( moves_tab[DIM-1][0] == opp_mark && moves_tab[0][DIM-1] == 0 ) {
        *prow = 1;
        *pcol = DIM;
        return true;
    }
    else if( moves_tab[DIM-1][DIM-1] == opp_mark && moves_tab[0][0] == 0 ) {
        *prow = 0;
        *pcol = 0;
        return true;
    }

    // find any corners if free
    if( moves_tab[0][0] == 0 ) {
        *prow = 1;
        *pcol = 1;
        return true;
    }
    else if( moves_tab[0][DIM-1] == 0 ) {
        *prow = 1;
        *pcol = DIM;
        return true;
    }
    else if( moves_tab[DIM-1][0] == 0 ) {
        *prow = DIM;
        *pcol = 1;
        return true;
    }
    else if( moves_tab[DIM-1][DIM-1] == 0 ) {
        *prow = DIM;
        *pcol = DIM;
        return true;
    }
    
    // find side spots if free
    i = (DIM%2 == 0)? DIM/2 -1: DIM/2;
    for( j=DIM/2; i>0 && j<DIM-1; i--, j++ ) {
        if( moves_tab[0][i] == 0 ) {
            *prow = 1;
            *pcol = i+1;
            return true;
        }
        else if( moves_tab[0][j] == 0 ) {
            *prow = 1;
            *pcol = j+1;
            return true;
        }
        else if( moves_tab[DIM-1][i] == 0 ) {
            *prow = DIM;
            *pcol = i+1;
            return true;
        }
        else if( moves_tab[DIM-1][j] == 0 ) {
            *prow = DIM;
            *pcol = j+1;
            return true;
        }
        else if( moves_tab[i][0] == 0 ) {
            *prow = i+1;
            *pcol = 1;
            return true;
        }
        else if( moves_tab[j][0] == 0 ) {
            *prow = j+1;
            *pcol = 1;
            return true;
        }
        else if( moves_tab[i][DIM-1] == 0 ) {
            *prow = i+1;
            *pcol = DIM;
            return true;
        }
        else if( moves_tab[j][DIM-1] == 0 ) {
            *prow = j+1;
            *pcol = DIM;
            return true;
        }
    }

    return false;

}


// Find any availabe spot (first available)
// this is the last resort to play a move
static bool find_a_move( int *prow, int *pcol )
{
    int i, j;
    
    //  first available
    for( i=0; i<DIM; i++) {
        for( j=0; j<DIM; j++) {
            if( moves_tab[i][j] == 0 ) {
                *prow = i+1;
                *pcol = j+1;
                return true;
            }
        }
    }

    return false;
}


// Get function to obtain firstplayer label
// this should be only way to access firstone
static player_t get_firstplayer( void )
{
    return firstone;
}


// Get function to obtain play mode (single, multiple) label
// this should be only way to access model
static playmode_t get_playmode( void )
{
    return mode;
}

