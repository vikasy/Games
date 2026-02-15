/*----------------------------------------------------------------
Copyright (c) 2018 Author: Vikas Yadav
file: dealnodealtest.cpp

This file test dealnodeal object
-----------------------------------------------------------------*/

/*----------------------------------------------------------------
All includes here
-----------------------------------------------------------------*/
#include "dealnodeal.h"

/*----------------------------------------------------------------
test 
-----------------------------------------------------------------*/

void testbed() {
    {
        cout << "TEST A (INTERACTIVE ONE GAME)" << endl;
        dealnodeal A;
        A.play_game();
    }
    {
        cout << "TEST B (NON-INTERACTIVE ONE GAME)" << endl;
        dealnodeal B;
        B.play_game();
    }
    {
        cout << "TEST C (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        dealnodeal C;
        C.play_game();
    }
    {
        cout << "TEST D (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        dealnodeal D;
        D.play_game();
    }
    {
        cout << "TEST X (NON-INTERACTIVE ONE GAME)" << endl;
        dealnodeal X;
        X.play_game(WITH_PC_ONESHOT);
    }
    {
        cout << "TEST Y (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        dealnodeal Y;
        Y.play_game(WITH_PC_MILLION);
    }
    {
        cout << "TEST Z (NON-INTERACTIVE MULTIPLE GAMES)" << endl;
        dealnodeal Z;
        Z.play_game(WITH_PC_ZERO);
    }
}


int main() {
    testbed();
    return 0;
}