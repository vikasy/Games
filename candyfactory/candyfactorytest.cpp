/*----------------------------------------------------------------
Copyright (c) 2018 Author: Vikas Yadav
file: candyfactorytest.cpp

This file test candyfactory object
-----------------------------------------------------------------*/

/*----------------------------------------------------------------
All includes here
-----------------------------------------------------------------*/
#include "candyfactory.h"

/*----------------------------------------------------------------
test 
-----------------------------------------------------------------*/

void testbed() {
    {
        cout << "TEST A (INTERACTIVE ONE GAME)" << endl;
        candyfactory A;
        A.play_game();
    }
    {
        cout << "TEST B (NON-INTERACTIVE ONE GAME)" << endl;
        candyfactory B;
        B.play_game();
    }
    {
        cout << "TEST C (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        candyfactory C;
        C.play_game();
    }
    {
        cout << "TEST D (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        candyfactory D;
        D.play_game();
    }
    {
        cout << "TEST X (NON-INTERACTIVE ONE GAME)" << endl;
        candyfactory X;
        X.play_game(WITH_PC_ONESHOT);
    }
    {
        cout << "TEST Y (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        candyfactory Y;
        Y.play_game(WITH_PC_MILLION);
    }
    {
        cout << "TEST Z (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        candyfactory Z;
        Z.play_game(WITH_PC_ZERO);
    }
}


int main() {
    testbed();
    return 0;
}