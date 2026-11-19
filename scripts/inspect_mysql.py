#!/usr/bin/env python3
"""
Target MySQL Database Inspection Script
Connects to the target MySQL instance and inspects:
- Connectivity and version
- Server and database character sets & collations
- SQL Mode
- Storage engine and system variables
- User grants and privileges
- Existing schemas and tables in 'pms_db'
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
    'connect_timeout': 10,
    'cursorclass': pymysql.cursors.DictCursor
}

def inspect():
    print(f"Connecting to MySQL database at {DB_CONFIG['host']}:{DB_CONFIG['port']}...")
    try:
        conn = pymysql.connect(**DB_CONFIG)
        print("Successfully connected to MySQL database.")
    except Exception as e:
        print(f"Connection failed: {e}", file=sys.stderr)
        return False

    report = {}
    with conn.cursor() as cursor:
        # 1. Version
        cursor.execute("SELECT VERSION() AS version;")
        report['version'] = cursor.fetchone()['version']
        
        # 2. Charset & Collation
        cursor.execute("""
            SELECT 
                @@character_set_server AS character_set_server,
                @@collation_server AS collation_server,
                @@character_set_database AS character_set_database,
                @@collation_database AS collation_database,
                @@character_set_connection AS character_set_connection,
                @@collation_connection AS collation_connection;
        """)
        report['charset_and_collation'] = cursor.fetchone()
        
        # 3. SQL Mode
        cursor.execute("SELECT @@sql_mode AS sql_mode;")
        report['sql_mode'] = cursor.fetchone()['sql_mode']
        
        # 4. Critical Variables
        cursor.execute("""
            SHOW VARIABLES WHERE Variable_name IN (
                'default_storage_engine',
                'foreign_key_checks',
                'innodb_file_per_table',
                'innodb_version',
                'lower_case_table_names',
                'max_allowed_packet',
                'sql_require_primary_key',
                'system_time_zone',
                'time_zone'
            );
        """)
        report['variables'] = {row['Variable_name']: row['Value'] for row in cursor.fetchall()}
        
        # 5. User Grants / Privileges
        cursor.execute("SHOW GRANTS;")
        report['grants'] = [list(row.values())[0] for row in cursor.fetchall()]
        
        # 6. Available Databases
        cursor.execute("SHOW DATABASES;")
        report['databases'] = [row['Database'] for row in cursor.fetchall()]
        
        # 7. Tables in pms_db
        cursor.execute("""
            SELECT 
                TABLE_NAME, 
                TABLE_TYPE, 
                ENGINE, 
                ROW_FORMAT, 
                TABLE_ROWS, 
                DATA_LENGTH, 
                INDEX_LENGTH, 
                TABLE_COLLATION,
                CREATE_TIME
            FROM information_schema.tables 
            WHERE table_schema = 'pms_db'
            ORDER BY TABLE_NAME;
        """)
        tables = cursor.fetchall()
        report['table_count'] = len(tables)
        report['tables'] = tables
        
        # 8. Table Details if existing
        report['table_schemas'] = {}
        for t in tables:
            tname = t['TABLE_NAME']
            cursor.execute(f"SHOW CREATE TABLE `{tname}`;")
            report['table_schemas'][tname] = cursor.fetchone()

    conn.close()
    
    print("\n" + "="*50)
    print("MYSQL TARGET INSPECTION REPORT")
    print("="*50)
    print(json.dumps(report, indent=2, default=str))
    return True

if __name__ == '__main__':
    success = inspect()
    sys.exit(0 if success else 1)
