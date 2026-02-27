import psycopg2

conn = psycopg2.connect(
    host="34.64.50.246",
    database="postgres",
    user="postgres",
    password="1qaz",
    port=5432
)

print("connected")
conn.close()