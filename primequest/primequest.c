/*
 * PrimeQuest — Primality Testing Algorithms
 * Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
 *
 * Standalone C implementation of all primality algorithms used in the
 * PrimeQuest educational game: parity, divisibility, Sieve of Eratosthenes,
 * perfect power detection, trial division, Fermat's test, polynomial Fermat
 * identity, and the full AKS primality test.
 *
 * Build: gcc -O2 -o primequest primequest.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>

/* ─── Parity ─────────────────────────────────────────────────────────── */

bool is_even(long long n) {
    return (n & 1) == 0;
}

/* ─── Divisibility ───────────────────────────────────────────────────── */

bool is_divisible(long long n, long long d) {
    return d != 0 && n % d == 0;
}

/* ─── Sieve of Eratosthenes ─────────────────────────────────────────── */

/* Returns count of primes found. primes_out must have room for at least
   limit+1 entries; primes are stored starting at primes_out[0]. */
int sieve_of_eratosthenes(int limit, int primes_out[]) {
    if (limit < 2) return 0;

    bool *is_composite = calloc(limit + 1, sizeof(bool));
    if (!is_composite) return 0;

    int count = 0;
    for (int i = 2; i <= limit; i++) {
        if (!is_composite[i]) {
            primes_out[count++] = i;
            for (long long j = (long long)i * i; j <= limit; j += i)
                is_composite[j] = true;
        }
    }
    free(is_composite);
    return count;
}

/* ─── Perfect Power Detection (AKS Step 1) ───────────────────────────── */

/* If n = base^exp for some base >= 2, exp >= 2, returns true and sets
   *out_base, *out_exp. Otherwise returns false. */
bool is_perfect_power(long long n, long long *out_base, int *out_exp) {
    if (n < 4) return false;

    int max_exp = (int)(log2((double)n)) + 1;
    for (int b = 2; b <= max_exp; b++) {
        double root = pow((double)n, 1.0 / b);
        long long lo = (long long)(root - 1);
        if (lo < 2) lo = 2;
        for (long long a = lo; a <= lo + 2; a++) {
            long long val = 1;
            bool overflow = false;
            for (int i = 0; i < b; i++) {
                val *= a;
                if (val > n) { overflow = true; break; }
            }
            if (!overflow && val == n) {
                if (out_base) *out_base = a;
                if (out_exp) *out_exp = b;
                return true;
            }
        }
    }
    return false;
}

/* ─── GCD and LCM ────────────────────────────────────────────────────── */

long long gcd_func(long long a, long long b) {
    while (b) { long long t = b; b = a % b; a = t; }
    return a;
}

long long lcm_func(long long a, long long b) {
    if (a == 0 || b == 0) return 0;
    return a / gcd_func(a, b) * b;
}

/* ─── Modular Exponentiation (repeated squaring) ─────────────────────── */

long long mod_pow(long long base, long long exp, long long mod) {
    if (mod == 1) return 0;
    long long result = 1;
    base %= mod;
    if (base < 0) base += mod;
    while (exp > 0) {
        if (exp & 1)
            result = (__int128)result * base % mod;
        exp >>= 1;
        base = (__int128)base * base % mod;
    }
    return result;
}

/* ─── Trial Division ─────────────────────────────────────────────────── */

/* Returns true if n is prime (tests divisors up to sqrt(n)). */
bool trial_division(long long n) {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (long long i = 5; i * i <= n; i += 6) {
        if (n % i == 0 || n % (i + 2) == 0)
            return false;
    }
    return true;
}

/* ─── Fermat Primality Test ──────────────────────────────────────────── */

/* Returns true if n passes Fermat test for base a: a^(n-1) ≡ 1 (mod n).
   Assumes 2 <= a < n and n >= 3. */
bool fermat_test(long long n, long long a) {
    if (n < 3) return n == 2;
    return mod_pow(a, n - 1, n) == 1;
}

/* ─── Binomial Coefficient mod m ─────────────────────────────────────── */

/* Computes C(n, k) mod m exactly using __int128 arithmetic.
   Works for both prime and composite m (up to reasonable sizes). */
long long binomial_mod(long long n, long long k, long long m) {
    if (k < 0 || k > n) return 0;
    if (k == 0 || k == n) return 1 % m;
    if (k > n - k) k = n - k;

    /* Compute C(n,k) exactly using __int128 then reduce mod m.
       This works for k up to ~30 or so without overflow in __int128.
       For larger k, use Lucas' theorem or row-based computation. */
    if (k <= 60) {
        __int128 num = 1;
        __int128 den = 1;
        for (long long i = 0; i < k; i++) {
            num *= (n - i);
            den *= (i + 1);
        }
        /* num/den is exact integer C(n,k) */
        __int128 binom = num / den;
        return (long long)(binom % m);
    }

    /* For larger k, build row of Pascal's triangle mod m */
    long long *row = calloc(k + 1, sizeof(long long));
    if (!row) return 0;
    row[0] = 1;
    for (long long i = 1; i <= n; i++) {
        long long jmax = i < k ? i : k;
        for (long long j = jmax; j >= 1; j--)
            row[j] = (row[j] + row[j - 1]) % m;
    }
    long long result = row[k];
    free(row);
    return result;
}

/* ─── Polynomial Fermat Check ────────────────────────────────────────── */

/* For prime p: (x+a)^p ≡ x^p + a (mod p), meaning all binomial
   coefficients C(p,k) for 0 < k < p are divisible by p.
   Returns true if ALL middle coefficients C(n,k) mod n == 0. */
bool polynomial_fermat_check(long long n, long long a) {
    if (n < 2) return false;
    if (n == 2) return true;
    (void)a; /* a doesn't affect whether C(n,k) mod n == 0 */

    for (long long k = 1; k < n; k++) {
        /* Direct computation: C(n,k) mod n.
           For prime n, every C(n,k) with 0<k<n is divisible by n
           because n appears in the numerator n! but not in k!(n-k)!. */
        long long coeff = binomial_mod(n, k, n);
        if (coeff != 0) return false;
    }
    return true;
}

/* ─── Euler's Totient ────────────────────────────────────────────────── */

long long euler_totient(long long n) {
    long long result = n;
    for (long long p = 2; p * p <= n; p++) {
        if (n % p == 0) {
            while (n % p == 0) n /= p;
            result -= result / p;
        }
    }
    if (n > 1) result -= result / n;
    return result;
}

/* ─── Multiplicative Order of a mod n ────────────────────────────────── */

/* Returns smallest k >= 1 such that a^k ≡ 1 (mod n), or 0 if gcd(a,n)!=1 */
static long long mult_order(long long a, long long n) {
    if (n <= 1) return 0;
    long long val = a % n;
    if (val == 0) return 0;
    for (long long k = 1; k <= n; k++) {
        if (val == 1) return k;
        val = (__int128)val * a % n;
    }
    return 0;
}

/* ─── Find suitable r for AKS (Step 2) ──────────────────────────────── */

/* Find smallest r such that ord_r(n) > (log2 n)^2. */
long long find_aks_r(long long n) {
    double log2n = log2((double)n);
    double bound = log2n * log2n;

    for (long long r = 2; ; r++) {
        /* skip r if gcd(r,n) != 1 and r divides n (handle separately) */
        long long g = r, b = n % r;
        while (b) { long long t = b; b = g % b; g = t; }
        if (g > 1) {
            if (r < n) continue; /* r shares factor with n — skip */
            /* r == n only if n is small; shouldn't happen */
        }
        long long ord = mult_order(n % r, r);
        if (ord > (long long)bound) return r;
    }
}

/* ─── AKS Polynomial Check (Step 5) ──────────────────────────────────── */

/* Check (x + a)^n ≡ x^n + a  (mod x^r - 1, mod n).
   Polynomial represented as array of r coefficients. */
bool aks_polynomial_check(long long n, long long a, long long r) {
    /* Allocate two polynomials of degree r-1 */
    long long *poly = calloc(r, sizeof(long long));  /* result */
    long long *temp = calloc(r, sizeof(long long));   /* scratch */
    if (!poly || !temp) { free(poly); free(temp); return false; }

    /* Start with polynomial = 1 */
    poly[0] = 1;

    /* base polynomial = x + a, represented as coefficients mod n */
    long long base_const = a % n;
    /* base[0] = a, base[1] = 1, rest = 0 */

    /* Compute (x+a)^n mod (x^r - 1, n) using repeated squaring */
    long long exp = n;
    /* We'll store "base" as a polynomial too */
    long long *bp = calloc(r, sizeof(long long));
    if (!bp) { free(poly); free(temp); return false; }
    bp[0] = base_const;
    bp[1 % r] = (bp[1 % r] + 1) % n;

    /* poly_mul: multiply poly by bp mod (x^r-1, n), store in poly */
    while (exp > 0) {
        if (exp & 1) {
            /* poly = poly * bp mod (x^r - 1, n) */
            memset(temp, 0, r * sizeof(long long));
            for (long long i = 0; i < r; i++) {
                if (poly[i] == 0) continue;
                for (long long j = 0; j < r; j++) {
                    if (bp[j] == 0) continue;
                    long long idx = (i + j) % r;
                    temp[idx] = (temp[idx] + (__int128)poly[i] * bp[j]) % n;
                }
            }
            memcpy(poly, temp, r * sizeof(long long));
        }
        /* bp = bp * bp mod (x^r - 1, n) */
        memset(temp, 0, r * sizeof(long long));
        for (long long i = 0; i < r; i++) {
            if (bp[i] == 0) continue;
            for (long long j = 0; j < r; j++) {
                if (bp[j] == 0) continue;
                long long idx = (i + j) % r;
                temp[idx] = (temp[idx] + (__int128)bp[i] * bp[j]) % n;
            }
        }
        memcpy(bp, temp, r * sizeof(long long));
        exp >>= 1;
    }

    /* Expected: x^n + a mod (x^r - 1) = x^(n mod r) + a */
    long long *expected = calloc(r, sizeof(long long));
    if (!expected) { free(poly); free(temp); free(bp); return false; }
    expected[0] = a % n;
    expected[n % r] = (expected[n % r] + 1) % n;

    bool match = true;
    for (long long i = 0; i < r; i++) {
        if (poly[i] != expected[i]) { match = false; break; }
    }

    free(poly); free(temp); free(bp); free(expected);
    return match;
}

/* ─── Full AKS Primality Test ────────────────────────────────────────── */

/* Returns true if n is prime, with step-by-step output. */
bool aks_primality(long long n, bool verbose) {
    if (n < 2) {
        if (verbose) printf("  %lld < 2 → NOT PRIME\n", n);
        return false;
    }
    if (n <= 3) {
        if (verbose) printf("  %lld is prime (base case)\n", n);
        return true;
    }

    /* Step 1: Perfect power check */
    long long base;
    int exp;
    if (is_perfect_power(n, &base, &exp)) {
        if (verbose) printf("  Step 1: %lld = %lld^%d → COMPOSITE (perfect power)\n", n, base, exp);
        return false;
    }
    if (verbose) printf("  Step 1: %lld is NOT a perfect power ✓\n", n);

    /* Step 2: Find smallest r with ord_r(n) > (log2 n)^2 */
    long long r = find_aks_r(n);
    if (verbose) printf("  Step 2: Found r = %lld (ord_r(n) > (log2 n)^2) ✓\n", r);

    /* Step 3: Check small factors from 2 to min(r, n-1) */
    long long check_limit = r < n - 1 ? r : n - 1;
    for (long long a = 2; a <= check_limit; a++) {
        long long g = a, b2 = n % a;
        while (b2) { long long t = b2; b2 = g % b2; g = t; }
        if (g > 1) {
            if (verbose) printf("  Step 3: gcd(%lld, %lld) = %lld > 1 → COMPOSITE\n", a, n, g);
            return false;
        }
    }
    if (verbose) printf("  Step 3: No small factors in [2, %lld] ✓\n", check_limit);

    /* Step 4: If n <= r, then n is prime */
    if (n <= r) {
        if (verbose) printf("  Step 4: n ≤ r → PRIME\n");
        return true;
    }
    if (verbose) printf("  Step 4: n > r, proceeding to polynomial checks\n");

    /* Step 5: For a = 1 to floor(sqrt(φ(r)) · log2(n)), check
       (x + a)^n ≡ x^n + a  (mod x^r - 1, n) */
    long long phi_r = euler_totient(r);
    long long limit = (long long)(sqrt((double)phi_r) * log2((double)n));
    if (verbose) printf("  Step 5: Checking polynomial identities for a = 1..%lld (r=%lld, φ(r)=%lld)\n",
                        limit, r, phi_r);

    for (long long a = 1; a <= limit; a++) {
        if (!aks_polynomial_check(n, a, r)) {
            if (verbose) printf("  Step 5: (x+%lld)^%lld ≢ x^%lld+%lld (mod x^%lld-1, %lld) → COMPOSITE\n",
                                a, n, n, a, r, n);
            return false;
        }
        if (verbose && a <= 3) printf("    a=%lld: polynomial check passed ✓\n", a);
    }
    if (verbose) printf("  Step 5: All %lld polynomial checks passed ✓\n", limit);

    if (verbose) printf("  → %lld is PRIME\n", n);
    return true;
}

/* ─── Interactive CLI ────────────────────────────────────────────────── */

static void print_separator(void) {
    printf("────────────────────────────────────────────\n");
}

int main(void) {
    printf("╔══════════════════════════════════════════╗\n");
    printf("║          PRIMEQUEST  ALGORITHMS          ║\n");
    printf("║   Primality Testing — All Methods        ║\n");
    printf("╚══════════════════════════════════════════╝\n\n");

    long long n;
    while (1) {
        printf("Enter a positive integer (0 to quit): ");
        if (scanf("%lld", &n) != 1 || n <= 0) break;

        print_separator();
        printf("Testing n = %lld\n", n);
        print_separator();

        /* Parity */
        printf("\n[1] Parity: %lld is %s\n", n, is_even(n) ? "EVEN" : "ODD");
        if (n > 2 && is_even(n))
            printf("    → Even numbers > 2 are never prime\n");

        /* GCD & LCM examples */
        if (n > 1) {
            long long other = n > 10 ? n - 7 : n + 3;
            long long g = gcd_func(n, other);
            long long l = lcm_func(n, other);
            printf("\n[2] GCD & LCM:\n");
            printf("    GCD(%lld, %lld) = %lld%s\n", n, other, g,
                   g == 1 ? " (coprime!)" : "");
            printf("    LCM(%lld, %lld) = %lld\n", n, other, l);
        }

        /* Trial division */
        bool td = trial_division(n);
        printf("\n[3] Trial Division (up to √%lld ≈ %d): %s\n",
               n, (int)sqrt((double)n), td ? "PRIME" : "COMPOSITE");

        /* Fermat test */
        if (n > 2) {
            int bases[] = {2, 3, 5, 7};
            int nbases = 4;
            printf("\n[4] Fermat's Test:\n");
            bool all_pass = true;
            for (int i = 0; i < nbases && bases[i] < n; i++) {
                long long r = mod_pow(bases[i], n - 1, n);
                bool pass = (r == 1);
                printf("    %d^(%lld-1) mod %lld = %lld → %s\n",
                       bases[i], n, n, r, pass ? "probably prime" : "COMPOSITE");
                if (!pass) all_pass = false;
            }
            if (all_pass && !td)
                printf("    ⚠  Fermat says probably prime, but trial division says composite!\n"
                       "    → This may be a Carmichael number.\n");
        }

        /* Polynomial Fermat (only for small n, since it checks n-1 coefficients) */
        if (n <= 1000) {
            bool pf = polynomial_fermat_check(n, 2);
            printf("\n[5] Polynomial Fermat ((x+a)^n ≡ x^n+a mod n): %s\n",
                   pf ? "PRIME" : "COMPOSITE");
        } else {
            printf("\n[5] Polynomial Fermat: skipped (n > 1000, too many coefficients)\n");
        }

        /* Perfect power */
        long long pp_base;
        int pp_exp;
        bool pp = is_perfect_power(n, &pp_base, &pp_exp);
        /* Binomial Coefficients — Pascal's row mod n */
        if (n >= 2 && n <= 30) {
            printf("\n[6] Binomial Coefficients (Pascal row %lld mod %lld):\n    ", n, n);
            for (long long k = 0; k <= n; k++) {
                long long c = binomial_mod(n, k, n);
                printf("%lld ", c);
            }
            bool all_zero = true;
            for (long long k = 1; k < n; k++) {
                if (binomial_mod(n, k, n) != 0) { all_zero = false; break; }
            }
            printf("\n    → Middle entries %s all zero → %s\n",
                   all_zero ? "ARE" : "are NOT", all_zero ? "PRIME pattern" : "COMPOSITE pattern");
        }

        printf("\n[7] Perfect Power: ");
        if (pp)
            printf("%lld = %lld^%d → COMPOSITE\n", n, pp_base, pp_exp);
        else
            printf("NOT a perfect power\n");

        /* Full AKS */
        if (n <= 100000) {
            printf("\n[8] AKS Primality Test (step-by-step):\n");
            bool aks = aks_primality(n, true);
            printf("    AKS result: %s\n", aks ? "PRIME" : "COMPOSITE");
        } else {
            printf("\n[8] AKS: skipped (n > 100000, polynomial checks too slow for CLI demo)\n");
            printf("    (In practice AKS runs in polynomial time but with large constants)\n");
        }

        /* Sieve context */
        if (n <= 1000) {
            int primes[200];
            int count = sieve_of_eratosthenes((int)n, primes);
            printf("\n[9] Sieve: %d primes up to %lld. ", count, n);
            if (count > 0) {
                printf("Last few: ");
                int start = count > 5 ? count - 5 : 0;
                for (int i = start; i < count; i++)
                    printf("%d%s", primes[i], i < count - 1 ? ", " : "");
            }
            printf("\n");
        }

        print_separator();
        printf("\n");
    }

    printf("\nGoodbye!\n");
    return 0;
}
