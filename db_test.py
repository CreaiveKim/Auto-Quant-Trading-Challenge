import psycopg2

HOST="127.0.0.1"
PORT=5432            # PostgreSQL 기본 포트
DB   = "quant"             # DB 이름
USER = "upbitpostgres"     # DB 유저
PW   = "1qaz"          # 비번

dsn = f"host={HOST} port={PORT} dbname={DB} user={USER} password={PW}"

conn = psycopg2.connect(dsn)
cur = conn.cursor()
cur.execute("SELECT 1;")
print(cur.fetchone())
conn.close()
print("OK CONNECT")