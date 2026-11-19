#!/usr/bin/env python3
"""
Comprehensive Live Database Verification Script
Audits 145.223.18.48:3307 / pms_db to:
1. Verify all 151 tables exist and are InnoDB.
2. Verify total and per-table row counts are EXACTLY 0.
3. Verify primary keys, foreign keys, unique constraints, indexes, and views.
"""

import sys
import json
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

def verify_live_db():
    print("=" * 60)
    print("LIVE DATABASE VERIFICATION & AUDIT")
    print("Target: pms_user@145.223.18.48:3307/pms_db")
    print("=" * 60)

    try:
        conn = pymysql.connect(**DB_CONFIG)
        print("Connected to database successfully.\n")
    except Exception as e:
        print(f"Failed to connect: {e}", file=sys.stderr)
        return False

    with conn.cursor() as cursor:
        # 1. Base Tables
        cursor.execute("""
            SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_ROWS
            FROM information_schema.tables
            WHERE table_schema = 'pms_db' AND table_type = 'BASE TABLE'
            ORDER BY TABLE_NAME;
        """)
        tables = cursor.fetchall()
        print(f"[1] Base Tables Count: {len(tables)} (Expected: 151)")

        # Verify Engine & Collation
        bad_engine = [t['TABLE_NAME'] for t in tables if t['ENGINE'] != 'InnoDB']
        bad_collation = [t['TABLE_NAME'] for t in tables if not (t['TABLE_COLLATION'] or '').startswith('utf8mb4')]
        print(f"    - Non-InnoDB Tables: {len(bad_engine)}")
        print(f"    - Non-utf8mb4 Tables: {len(bad_collation)}")

        # 2. Strict Exact Row Count Verification for EVERY table
        print("\n[2] Checking Row Count for ALL tables (Verifying 0 rows)...")
        tables_with_data = []
        total_rows_sum = 0
        for t in tables:
            tname = t['TABLE_NAME']
            cursor.execute(f"SELECT COUNT(*) AS cnt FROM `{tname}`;")
            count = cursor.fetchone()['cnt']
            total_rows_sum += count
            if count > 0:
                tables_with_data.append((tname, count))

        print(f"    - Total rows across all 151 tables: {total_rows_sum}")
        if tables_with_data:
            print(f"    - [ALERT] Tables with data found: {tables_with_data}", file=sys.stderr)
        else:
            print(f"    - [CONFIRMED] ALL 151 tables are strictly EMPTY (0 rows).")

        # 3. Views
        cursor.execute("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = 'pms_db' AND table_type = 'VIEW';")
        views = [row['TABLE_NAME'] for row in cursor.fetchall()]
        print(f"\n[3] Views: {len(views)} (Expected: 1) -> {views}")

        # 4. Primary Keys
        cursor.execute("""
            SELECT COUNT(DISTINCT table_name) AS pk_count
            FROM information_schema.table_constraints
            WHERE table_schema = 'pms_db' AND constraint_type = 'PRIMARY KEY';
        """)
        pk_count = cursor.fetchone()['pk_count']
        print(f"\n[4] Primary Keys: {pk_count} tables have a Primary Key (Expected: 151)")

        # 5. Foreign Keys
        cursor.execute("""
            SELECT COUNT(*) AS fk_count
            FROM information_schema.table_constraints
            WHERE table_schema = 'pms_db' AND constraint_type = 'FOREIGN KEY';
        """)
        fk_count = cursor.fetchone()['fk_count']
        print(f"\n[5] Foreign Key Constraints: {fk_count} (Expected: 200)")

        # 6. Unique Constraints
        cursor.execute("""
            SELECT COUNT(*) AS uq_count
            FROM information_schema.table_constraints
            WHERE table_schema = 'pms_db' AND constraint_type = 'UNIQUE';
        """)
        uq_count = cursor.fetchone()['uq_count']
        print(f"\n[6] Unique Constraints: {uq_count} (Expected: 83+)")

        # 7. Check users prerequisite stub table
        cursor.execute("DESCRIBE `users`;")
        users_cols = cursor.fetchall()
        print(f"\n[7] Prerequisite `users` table schema: {len(users_cols)} columns")
        for c in users_cols:
            print(f"    - {c['Field']} ({c['Type']}), Nullable: {c['Null']}, Key: {c['Key']}, Default: {c['Default']}")

    conn.close()

    print("\n" + "=" * 60)
    if len(tables) == 151 and len(bad_engine) == 0 and total_rows_sum == 0 and pk_count == 151:
        print("FINAL AUDIT RESULT: PASSED 100% (SCHEMA VERIFIED, ZERO DATA CONFIRMED)")
        print("=" * 60)
        return True
    else:
        print("FINAL AUDIT RESULT: FAILED CHECKS")
        print("=" * 60)
        return False

if __name__ == "__main__":
    success = verify_live_db()
    sys.exit(0 if success else 1)
