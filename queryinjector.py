#!/usr/bin/env python3
"""Interactive DB helper — uses DATABASE_URL from the environment only."""
import os
import sys
import time

import psycopg2


def connection_url():
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        sys.stderr.write("Set DATABASE_URL (e.g. export from backend/.env)\n")
        sys.exit(1)
    return url


def run_query(query):
    conn = psycopg2.connect(connection_url())
    cur = conn.cursor()
    start_time = time.time()
    try:
        cur.execute(query)
        try:
            result = cur.fetchall()
        except psycopg2.ProgrammingError:
            result = "Query executed (no rows returned)"
        conn.commit()
    except Exception as e:
        result = f"Error: {e}"

    print("\n----- RESULT -----")
    print(result)
    print("\n----- EXECUTION TIME -----")
    print(f"{time.time() - start_time:.6f} seconds")

    cur.close()
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_query(" ".join(sys.argv[1:]))
        sys.exit(0)

    while True:
        q = input("\nEnter SQL Query (or type 'exit'): ")
        if q.lower() == "exit":
            break
        run_query(q)
