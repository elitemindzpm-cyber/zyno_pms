#!/usr/bin/env python3
"""
scripts/apply_mysql_schema.py
Connects to target MariaDB/MySQL instance and executes `scripts/01_pms_mariadb_schema.sql`.
Reports detailed statement-by-statement progress and runs immediate post-application verification.
"""

import os
import sys
import time
import pymysql

DB_CONFIG = {
    'host': '145.223.18.48',
    'port': 3307,
    'user': 'pms_user',
    'password': 'lite$#20',
    'database': 'pms_db',
    'connect_timeout': 30,
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

DDL_FILE = os.path.join(os.path.dirname(__file__), "01_pms_mariadb_schema.sql")

def split_sql_statements(sql_text):
    """Splits SQL script into individual statements safely."""
    statements = []
    current = []
    in_string = False
    escape = False
    quote_char = None
    
    for line in sql_text.splitlines():
        trimmed = line.strip()
        # Skip pure comment lines
        if not in_string and (trimmed.startswith("--") or trimmed.startswith("#")):
            continue
        if not trimmed and not current:
            continue
            
        current.append(line)
        
        # Check if line ends a statement
        for char in line:
            if escape:
                escape = False
                continue
            if char == '\\':
                escape = True
                continue
            if char in ("'", '"', '`'):
                if not in_string:
                    in_string = True
                    quote_char = char
                elif quote_char == char:
                    in_string = False
                    quote_char = None
                    
        if not in_string and trimmed.endswith(";"):
            stmt = "\n".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            
    if current:
        stmt = "\n".join(current).strip()
        if stmt:
            statements.append(stmt)
            
    return statements

def apply_ddl():
    print("=" * 60)
    print("APPLYING MARIADB SCHEMA TO TARGET DATABASE")
    print("=" * 60)
    print(f"Target: {DB_CONFIG['user']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
    print(f"DDL Source: {DDL_FILE}")
    
    if not os.path.exists(DDL_FILE):
        print(f"Error: DDL file not found at {DDL_FILE}", file=sys.stderr)
        return False

    with open(DDL_FILE, "r", encoding="utf-8") as f:
        sql_content = f.read()

    statements = split_sql_statements(sql_content)
    print(f"Parsed {len(statements)} individual SQL statements to execute.")

    print("\nConnecting to database...")
    try:
        conn = pymysql.connect(**DB_CONFIG)
        print("Connected successfully.")
    except Exception as e:
        print(f"Fatal connection failure: {e}", file=sys.stderr)
        return False

    start_time = time.time()
    success_count = 0
    errors = []

    with conn.cursor() as cursor:
        for idx, stmt in enumerate(statements, start=1):
            # Identify statement category for logging
            first_line = stmt.strip().splitlines()[0]
            if len(first_line) > 80:
                first_line = first_line[:77] + "..."
                
            try:
                cursor.execute(stmt)
                success_count += 1
                if idx % 50 == 0 or idx == len(statements) or "CREATE TABLE" in stmt or "VIEW" in stmt:
                    print(f"[{idx}/{len(statements)}] Executed: {first_line}")
            except Exception as e:
                err_msg = f"Statement #{idx} failed: {e}\nSQL:\n{stmt[:200]}..."
                print(f"\n[ERROR] {err_msg}\n", file=sys.stderr)
                errors.append(err_msg)
                # If error is critical, stop
                if "CREATE TABLE" in stmt or "SET NAMES" in stmt:
                    print("Critical DDL error encountered. Halting execution.", file=sys.stderr)
                    conn.rollback()
                    conn.close()
                    return False

        conn.commit()

    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"DDL EXECUTION SUMMARY: {success_count}/{len(statements)} succeeded in {elapsed:.2f}s")
    print(f"Total Errors: {len(errors)}")
    print("=" * 60)

    # Post-execution verification
    print("\nRunning post-execution verification...")
    with conn.cursor() as cursor:
        # 1. Table count
        cursor.execute("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'pms_db' AND table_type = 'BASE TABLE';")
        tbl_count = cursor.fetchone()['count']
        print(f"[*] Base Tables Created: {tbl_count} (Expected: 151)")

        # 2. View count
        cursor.execute("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'pms_db' AND table_type = 'VIEW';")
        view_count = cursor.fetchone()['count']
        print(f"[*] Views Created: {view_count} (Expected: 1)")

        # 3. Primary keys count
        cursor.execute("SELECT COUNT(DISTINCT table_name) AS count FROM information_schema.table_constraints WHERE table_schema = 'pms_db' AND constraint_type = 'PRIMARY KEY';")
        pk_count = cursor.fetchone()['count']
        print(f"[*] Tables with Primary Keys: {pk_count} (Expected: 151)")

        # 4. Foreign keys count
        cursor.execute("SELECT COUNT(*) AS count FROM information_schema.table_constraints WHERE table_schema = 'pms_db' AND constraint_type = 'FOREIGN KEY';")
        fk_count = cursor.fetchone()['count']
        print(f"[*] Foreign Key Constraints: {fk_count} (Expected: 200)")

        # 5. Non-InnoDB tables
        cursor.execute("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'pms_db' AND table_type = 'BASE TABLE' AND engine != 'InnoDB';")
        non_innodb = cursor.fetchone()['count']
        print(f"[*] Non-InnoDB Tables: {non_innodb} (Expected: 0)")

    conn.close()
    
    if len(errors) == 0 and tbl_count == 151:
        print("\n[SUCCESS] Migration execution completed cleanly with 0 errors!")
        return True
    else:
        print("\n[WARNING] Migration executed with warnings/issues. Review logs above.", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = apply_ddl()
    sys.exit(0 if success else 1)
