import re
import sys

def check_ddl(sql_path):
    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # Find table definitions
    table_cols = {}
    table_pats = re.finditer(r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`([a-zA-Z0-9_]+)`\s*\((.*?)\)\s*ENGINE=InnoDB", sql, re.DOTALL)
    for tm in table_pats:
        tname = tm.group(1)
        body = tm.group(2)
        cols = {}
        for line in body.split("\n"):
            line = line.strip()
            if line.startswith("`"):
                cm = re.match(r"`([a-zA-Z0-9_]+)`\s+([A-Za-z0-9_]+(?:\([^\)]+\))?)", line)
                if cm:
                    cols[cm.group(1)] = cm.group(2).upper()
        table_cols[tname] = cols

    print(f"Loaded {len(table_cols)} tables.")

    # Check indexes
    idx_pats = re.finditer(r"CREATE\s+(UNIQUE\s+)?INDEX\s+`([a-zA-Z0-9_]+)`\s+ON\s+`([a-zA-Z0-9_]+)`\s*\((.*?)\);", sql)
    issues = []
    for im in idx_pats:
        iname = im.group(2)
        tname = im.group(3)
        cols_str = im.group(4)
        cols = [c.strip().strip("`") for c in cols_str.split(",")]
        for c in cols:
            if tname not in table_cols:
                issues.append(f"Index {iname}: table {tname} not found")
                continue
            if c not in table_cols[tname]:
                issues.append(f"Index {iname}: column {c} not found in table {tname}")
            else:
                ctype = table_cols[tname][c]
                if ctype in ("TEXT", "LONGTEXT", "MEDIUMTEXT", "TINYTEXT", "BLOB", "JSON"):
                    issues.append(f"Index {iname}: column {c} on {tname} has type {ctype} which requires prefix length or cannot be indexed without length!")

    # Check unique constraints in ALTER TABLE
    uniq_pats = re.finditer(r"ALTER\s+TABLE\s+`([a-zA-Z0-9_]+)`\s+ADD\s+CONSTRAINT\s+`([a-zA-Z0-9_]+)`\s+UNIQUE\s*\((.*?)\);", sql)
    for um in uniq_pats:
        tname = um.group(1)
        cname = um.group(2)
        cols_str = um.group(3)
        cols = [c.strip().strip("`") for c in cols_str.split(",")]
        for c in cols:
            if tname in table_cols and c in table_cols[tname]:
                ctype = table_cols[tname][c]
                if ctype in ("TEXT", "LONGTEXT", "MEDIUMTEXT", "TINYTEXT", "BLOB", "JSON"):
                    issues.append(f"UNIQUE constraint {cname}: column {c} on {tname} has type {ctype} which cannot be in standard unique constraint without prefix!")

    print(f"Total potential index/constraint issues found: {len(issues)}")
    for iss in issues[:30]:
        print(" -", iss)
    if len(issues) > 30:
        print(f" ... and {len(issues)-30} more.")

if __name__ == "__main__":
    check_ddl("scripts/01_pms_mariadb_schema.sql")
