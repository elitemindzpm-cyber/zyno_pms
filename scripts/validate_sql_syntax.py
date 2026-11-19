import re
import sys

def validate_ddl(sql_path):
    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # Split statements
    statements = [stmt.strip() for stmt in sql.split(";") if stmt.strip()]
    
    tables_created = set()
    table_columns = {}
    errors = []
    warnings = []

    for stmt in statements:
        # Ignore comments and session commands
        clean_stmt = "\n".join([line for line in stmt.split("\n") if not line.strip().startswith("--")]).strip()
        if not clean_stmt or clean_stmt.upper().startswith(("SET ", "START TRANSACTION", "COMMIT")):
            continue

        # CREATE TABLE
        m_create = re.match(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?\s*\((.*)\)\s*ENGINE", clean_stmt, re.DOTALL | re.IGNORECASE)
        if m_create:
            tname = m_create.group(1)
            tables_created.add(tname)
            cols = []
            for line in m_create.group(2).split("\n"):
                line = line.strip()
                if not line or line.startswith(("--", "PRIMARY KEY", "KEY", "UNIQUE", "CONSTRAINT")):
                    continue
                cm = re.match(r"`?([a-zA-Z0-9_]+)`?", line)
                if cm:
                    cols.append(cm.group(1))
            table_columns[tname] = cols
            continue

        # ALTER TABLE ADD CONSTRAINT FOREIGN KEY
        m_fk = re.search(r"ALTER\s+TABLE\s+`?([a-zA-Z0-9_]+)`?\s+ADD\s+CONSTRAINT\s+`?([a-zA-Z0-9_]+)`?\s+FOREIGN\s+KEY\s*\(`?([a-zA-Z0-9_]+)`?\)\s+REFERENCES\s+`?([a-zA-Z0-9_]+)`?\s*\(`?([a-zA-Z0-9_]+)`?\)", clean_stmt, re.IGNORECASE)
        if m_fk:
            tname, cname, col, ref_table, ref_col = m_fk.groups()
            if tname not in tables_created:
                errors.append(f"FK error: Table `{tname}` not created before FK `{cname}`")
            if ref_table not in tables_created:
                errors.append(f"FK error: Referenced Table `{ref_table}` not created for FK `{cname}`")
            if tname in table_columns and col not in table_columns[tname]:
                errors.append(f"FK error: Column `{col}` not found in `{tname}` for FK `{cname}`")
            if ref_table in table_columns and ref_col not in table_columns[ref_table]:
                errors.append(f"FK error: Ref Column `{ref_col}` not found in `{ref_table}` for FK `{cname}`")
            continue

        # CREATE INDEX
        m_idx = re.match(r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+`?([a-zA-Z0-9_]+)`?\s+ON\s+`?([a-zA-Z0-9_]+)`?\s*\((.*)\)", clean_stmt, re.IGNORECASE)
        if m_idx:
            iname, tname, idx_cols_raw = m_idx.groups()
            if tname not in tables_created:
                errors.append(f"Index error: Table `{tname}` not found for index `{iname}`")
            cols_in_idx = [re.sub(r"[`\s]", "", c) for c in idx_cols_raw.split(",")]
            for c in cols_in_idx:
                if tname in table_columns and c not in table_columns[tname]:
                    errors.append(f"Index error: Column `{c}` in index `{iname}` not found in `{tname}` (Available: {table_columns[tname][:5]}...)")
            continue

    print(f"Total tables detected: {len(tables_created)}")
    print(f"Total errors detected: {len(errors)}")
    for err in errors:
        print(f"  [ERROR] {err}")
    if not errors:
        print("ALL STATIC STRUCTURAL CHECKS PASSED!")

if __name__ == "__main__":
    validate_ddl("scripts/01_pms_mariadb_schema.sql")
