import psycopg2
import time

# paste your Neon DB connection string here
DATABASE_URL="postgresql://neondb_owner:npg_5KRj3TWeuXry@ep-long-bar-a1abyz8y-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

def run_query(query):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    start_time = time.time()
    try:
        cur.execute(query)
        # try fetching results if query returns rows
        try:
            result = cur.fetchall()
        except psycopg2.ProgrammingError:
            result = "Query executed (no rows returned)"

        conn.commit()

    except Exception as e:
        result = f"Error: {e}"

    end_time = time.time()

    execution_time = end_time - start_time

    print("\n----- RESULT -----")
    print(result)

    print("\n----- EXECUTION TIME -----")
    print(f"{execution_time:.6f} seconds")

    cur.close()
    conn.close()


if __name__ == "__main__":
    while True:
        query = input("\nEnter SQL Query (or type 'exit'): ")
        if query.lower() == "exit":
            break
        run_query(query)