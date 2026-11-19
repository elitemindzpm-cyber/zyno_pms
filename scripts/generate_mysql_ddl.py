#!/usr/bin/env python3
"""
scripts/generate_mysql_ddl.py
Translates Supabase PostgreSQL 17.6 schema dump (01_architecture_and_schema.sql)
into MariaDB 10.5+ / MySQL 8.0+ syntax for target `pms_db`.
"""

import os
import re
import sys
from collections import defaultdict

SRC_SQL = os.path.join(os.path.dirname(__file__), "..", "supabase_export", "01_architecture_and_schema.sql")
OUT_SQL = os.path.join(os.path.dirname(__file__), "01_pms_mariadb_schema.sql")

def generate_mariadb_ddl(src_path, out_path):
    print(f"Reading PostgreSQL DDL from: {src_path}")
    with open(src_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    # 1. Parse public enums
    enums = {}
    for m in re.finditer(r"CREATE\s+TYPE\s+public\.([a-zA-Z0-9_\"]+)\s+AS\s+ENUM\s*\((.*?)\);", content, re.DOTALL | re.IGNORECASE):
        ename = m.group(1).replace('"', '')
        vals = [v.strip().strip("'") for v in m.group(2).split(",")]
        enums[ename] = vals

    print(f"Found {len(enums)} custom ENUMs in public schema.")

    # 2. Parse PKs
    pk_pattern = re.compile(r"ALTER\s+TABLE(?:\s+ONLY)?\s+public\.([a-zA-Z0-9_\"]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_\"]+)\s+PRIMARY\s+KEY\s*\((.*?)\);", re.IGNORECASE)
    pks_by_table = {}
    key_columns = defaultdict(set) # columns used in PK, FK, or UNIQUE
    for m in pk_pattern.finditer(content):
        tname = m.group(1).replace('"', '')
        cname = m.group(2).replace('"', '')
        cols = [c.strip().replace('"', '') for c in m.group(3).split(',')]
        pks_by_table[tname] = (cname, cols)
        for col in cols:
            key_columns[tname].add(col)

    # 3. Parse UNIQUE constraints
    uniq_pattern = re.compile(r"ALTER\s+TABLE(?:\s+ONLY)?\s+public\.([a-zA-Z0-9_\"]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_\"]+)\s+UNIQUE\s*\((.*?)\);", re.IGNORECASE)
    uniqs = []
    for m in uniq_pattern.finditer(content):
        tname = m.group(1).replace('"', '')
        cname = m.group(2).replace('"', '')
        cols = [c.strip().replace('"', '') for c in m.group(3).split(',')]
        uniqs.append((tname, cname, cols))
        for col in cols:
            key_columns[tname].add(col)

    # 4. Parse Foreign Keys
    fk_pattern = re.compile(
        r"ALTER\s+TABLE(?:\s+ONLY)?\s+public\.([a-zA-Z0-9_\"]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_\"]+)\s+FOREIGN\s+KEY\s*\((.*?)\)\s*REFERENCES\s+([a-zA-Z0-9_\.\"]+)\s*\((.*?)\)(.*?);",
        re.DOTALL | re.IGNORECASE
    )
    fks = []
    for m in fk_pattern.finditer(content):
        src_table = m.group(1).replace('"', '')
        cname = m.group(2).replace('"', '')
        src_cols = [c.strip().replace('"', '') for c in m.group(3).split(',')]
        target_table = m.group(4).replace('"', '')
        target_cols = [c.strip().replace('"', '') for c in m.group(5).split(',')]
        extra = m.group(6).strip()
        
        # Normalize target table
        if target_table in ("auth.users", "users"):
            target_table = "users"
        else:
            target_table = target_table.replace("public.", "")

        fks.append((src_table, cname, src_cols, target_table, target_cols, extra))
        for col in src_cols:
            key_columns[src_table].add(col)
        for col in target_cols:
            key_columns[target_table].add(col)

    # 5. Parse Indexes
    idx_pattern = re.compile(r"CREATE\s+(UNIQUE\s+)?INDEX\s+([a-zA-Z0-9_\"]+)\s+ON\s+public\.([a-zA-Z0-9_\"]+)(.*?);", re.DOTALL | re.IGNORECASE)
    indexes = []
    for m in idx_pattern.finditer(content):
        unique = bool(m.group(1))
        iname = m.group(2).replace('"', '')
        tname = m.group(3).replace('"', '')
        rest = m.group(4).strip()
        indexes.append((unique, iname, tname, rest))
        
        # Populate key_columns with columns referenced in indexes
        if iname in ("fin_transaction_account_rules_active_uniq", "fin_txn_rules_uq"):
            for col in ("transaction_type", "payment_method", "deposit_type", "pdc_type"):
                key_columns[tname].add(col)
        else:
            m_cols = re.search(r"\((.*?)\)", rest)
            if m_cols:
                words = re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\b", m_cols.group(1))
                for w in words:
                    if w.lower() not in ("coalesce", "using", "btree", "text", "null", "__null__", "lower", "upper"):
                        key_columns[tname].add(w)

    # 6. Parse Tables
    table_pattern = re.compile(r"CREATE\s+TABLE\s+public\.([a-zA-Z0-9_\"]+)\s*\((.*?)\n\);", re.DOTALL | re.IGNORECASE)
    tables = []
    for m in table_pattern.finditer(content):
        tname = m.group(1).replace('"', '')
        body = m.group(2)
        tables.append((tname, body))

    print(f"Parsed {len(tables)} public tables, {len(pks_by_table)} PKs, {len(uniqs)} Unique keys, {len(fks)} FKs, {len(indexes)} Indexes.")

    # Begin DDL assembly
    out = []
    out.append("-- =====================================================================")
    out.append("-- PMS Database Schema Migration: Supabase PostgreSQL -> MariaDB 10.5+ / MySQL 8+")
    out.append("-- Target Database: pms_db")
    out.append("-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_general_ci")
    out.append("-- Total Application Tables: 151 (150 public + 1 users identity stub)")
    out.append("-- =====================================================================")
    out.append("SET NAMES utf8mb4;")
    out.append("SET FOREIGN_KEY_CHECKS = 0;")
    out.append("SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';")
    out.append("START TRANSACTION;")
    out.append("")

    # Prerequisite: users identity stub
    out.append("-- =====================================================================")
    out.append("-- 0. PREREQUISITE: User Identity Table (resolving 9 auth.users FKs)")
    out.append("-- =====================================================================")
    out.append("CREATE TABLE IF NOT EXISTS `users` (")
    out.append("    `id` VARCHAR(36) NOT NULL,")
    out.append("    `email` VARCHAR(255) NULL,")
    out.append("    `role` VARCHAR(50) DEFAULT 'USER',")
    out.append("    `raw_user_meta_data` JSON NULL,")
    out.append("    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),")
    out.append("    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),")
    out.append("    PRIMARY KEY (`id`),")
    out.append("    UNIQUE KEY `uq_users_email` (`email`)")
    out.append(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;")
    out.append("")

    # Helper: Convert data type
    def convert_type(tname, col_name, raw_type):
        t_clean = raw_type.lower().strip()
        
        # UUID
        if t_clean == "uuid":
            return "VARCHAR(36)"
        
        # Timestamp
        if "timestamp with time zone" in t_clean or t_clean == "timestamptz":
            return "DATETIME(6)"
        if "timestamp without time zone" in t_clean or t_clean == "timestamp":
            return "DATETIME(6)"
        
        # Date & Time
        if t_clean == "date":
            return "DATE"
        if "time without time zone" in t_clean or t_clean == "time":
            return "TIME(6)"
        
        # Boolean
        if t_clean == "boolean":
            return "TINYINT(1)"
        
        # Integers
        if t_clean in ("integer", "int4", "int"):
            return "INT"
        if t_clean in ("bigint", "int8"):
            return "BIGINT"
        if t_clean in ("smallint", "int2"):
            return "SMALLINT"
        
        # Varchar
        if t_clean.startswith("character varying"):
            m = re.search(r"\((\d+)\)", t_clean)
            length = m.group(1) if m else "255"
            return f"VARCHAR({length})"
        
        # Arrays
        if "[]" in t_clean:
            return "JSON"
            
        # JSON / JSONB
        if t_clean in ("jsonb", "json"):
            return "JSON"
            
        # Numeric / Decimal
        if t_clean.startswith("numeric"):
            m = re.search(r"\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)", t_clean)
            if m:
                p = m.group(1)
                s = m.group(2) if m.group(2) else "0"
                return f"DECIMAL({p}, {s})"
            else:
                return "DECIMAL(18, 4)"
                
        # Geography / Spatial
        if "geography" in t_clean or "geometry" in t_clean or "point" in t_clean:
            return "POINT"
            
        # Public custom enums
        for ename, evals in enums.items():
            if ename in t_clean or f"public.{ename}" in t_clean:
                # Format as MySQL ENUM
                quoted_vals = ", ".join([f"'{v}'" for v in evals])
                return f"ENUM({quoted_vals})"
                
        # Text
        if t_clean == "text":
            # If used as key, unique, index, or common identifier, use VARCHAR(255)
            if col_name in key_columns[tname] or col_name in (
                "id", "code", "name", "email", "phone", "status", "type", "title",
                "key", "category", "number", "symbol", "method", "role", "slug",
                "action", "currency", "country", "city", "state", "postal_code",
                "color", "icon", "url", "path", "prefix", "document_type", "document_number",
                "receipt_no", "voucher_no", "asset_code", "employee_id_code"
            ):
                return "VARCHAR(255)"
            else:
                return "TEXT"
                
        # Fallback
        return raw_type

    # Helper: Convert default expression
    def convert_default(tname, col_name, target_type, raw_default):
        d = raw_default.strip()
        
        # UUID
        if "gen_random_uuid()" in d.lower():
            return "DEFAULT (UUID())"
            
        # Timestamps
        if "now()" in d.lower() or "current_timestamp" in d.lower():
            if col_name == "updated_at":
                return "DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
            return "DEFAULT CURRENT_TIMESTAMP(6)"
            
        # Current Date
        if "current_date" in d.lower():
            return "DEFAULT (CURRENT_DATE)"
            
        # JSON defaults
        if "'[]'::jsonb" in d.lower() or "'[]'" in d:
            return "DEFAULT ('[]')"
        if "'{}'::jsonb" in d.lower() or "'{}'" in d:
            return "DEFAULT ('{}')"
            
        # Array defaults (e.g. ARRAY['Property CRUD'::text, ...])
        if d.upper().startswith("ARRAY["):
            elements = re.findall(r"'([^']*)'", d)
            import json
            json_arr = json.dumps(elements).replace("'", "\\'")
            return f"DEFAULT ('{json_arr}')"
            
        # Boolean defaults
        if d.lower() in ("true", "'true'::boolean"):
            return "DEFAULT 1"
        if d.lower() in ("false", "'false'::boolean"):
            return "DEFAULT 0"
            
        # Text/Enum defaults with type casts (e.g. 'DRAFT'::public.proc_doc_status, 'Active'::text)
        cast_m = re.match(r"^'([^']*)'::", d)
        if cast_m:
            val = cast_m.group(1)
            return f"DEFAULT '{val}'"
            
        # Numeric literals
        if re.match(r"^-?\d+(\.\d+)?$", d):
            return f"DEFAULT {d}"
            
        # Simple quoted string
        if d.startswith("'") and d.endswith("'"):
            return f"DEFAULT {d}"
            
        # Sequences / nextval
        if "nextval(" in d.lower():
            return "AUTO_INCREMENT"
            
        # Cleaned fallback
        d_clean = re.sub(r"::[a-zA-Z0-9_\.]+", "", d)
        return f"DEFAULT {d_clean}"

    # Generate each table
    out.append("-- =====================================================================")
    out.append("-- 1. APPLICATION TABLES (150 tables)")
    out.append("-- =====================================================================")
    
    for tname, body in tables:
        lines = body.split("\n")
        col_defs = []
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith("--") or line.startswith("CONSTRAINT"):
                continue
                
            col_m = re.match(r'^"?([a-zA-Z0-9_]+)"?\s+([^,]+)', line)
            if not col_m:
                continue
                
            cname = col_m.group(1)
            crest = col_m.group(2).rstrip(',')
            
            # Check for NOT NULL
            is_not_null = bool(re.search(r'\bNOT\s+NULL\b', crest, re.IGNORECASE))
            
            # Check for DEFAULT
            default_clause = ""
            if "DEFAULT" in crest.upper():
                parts = re.split(r'\bDEFAULT\b', crest, maxsplit=1, flags=re.IGNORECASE)
                type_part = parts[0].strip()
                def_part = parts[1].strip()
                # strip trailing NOT NULL / NULL
                def_part = re.sub(r'\s+NOT\s+NULL\s*$', '', def_part, flags=re.IGNORECASE)
                def_part = re.sub(r'\s+NULL\s*$', '', def_part, flags=re.IGNORECASE).strip()
            else:
                type_part = re.sub(r'\s+(?:NOT\s+NULL|NULL)\s*$', '', crest, flags=re.IGNORECASE).strip()
                def_part = None
                
            # Convert type
            target_type = convert_type(tname, cname, type_part)
            
            # Convert default
            if def_part is not None:
                default_clause = convert_default(tname, cname, target_type, def_part)
            elif cname == "updated_at" and "DATETIME" in target_type:
                default_clause = "DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
            elif cname == "created_at" and "DATETIME" in target_type and is_not_null:
                default_clause = "DEFAULT CURRENT_TIMESTAMP(6)"
                
            # Handle AUTO_INCREMENT
            auto_inc = ""
            if "AUTO_INCREMENT" in default_clause:
                auto_inc = "AUTO_INCREMENT"
                default_clause = ""
                
            null_clause = "NOT NULL" if is_not_null else "NULL"
            
            parts_stmt = [f"`{cname}`", target_type]
            if null_clause:
                parts_stmt.append(null_clause)
            if default_clause:
                parts_stmt.append(default_clause)
            if auto_inc:
                parts_stmt.append(auto_inc)
                
            col_defs.append("    " + " ".join(parts_stmt))
            
        out.append(f"-- Table: {tname}")
        out.append(f"CREATE TABLE IF NOT EXISTS `{tname}` (")
        out.append(",\n".join(col_defs))
        out.append(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;")
        out.append("")

    # Primary Keys
    out.append("-- =====================================================================")
    out.append("-- 2. PRIMARY KEYS")
    out.append("-- =====================================================================")
    for tname, (cname, cols) in sorted(pks_by_table.items()):
        quoted_cols = ", ".join([f"`{c}`" for c in cols])
        out.append(f"ALTER TABLE `{tname}` ADD CONSTRAINT `{cname}` PRIMARY KEY ({quoted_cols});")
    out.append("")

    # Unique Constraints
    out.append("-- =====================================================================")
    out.append("-- 3. UNIQUE CONSTRAINTS")
    out.append("-- =====================================================================")
    for tname, cname, cols in sorted(uniqs):
        quoted_cols = ", ".join([f"`{c}`" for c in cols])
        out.append(f"ALTER TABLE `{tname}` ADD CONSTRAINT `{cname}` UNIQUE ({quoted_cols});")
    out.append("")

    # Foreign Keys
    out.append("-- =====================================================================")
    out.append("-- 4. FOREIGN KEYS")
    out.append("-- =====================================================================")
    for src_t, cname, src_cols, tgt_t, tgt_cols, extra in sorted(fks):
        q_src_cols = ", ".join([f"`{c}`" for c in src_cols])
        q_tgt_cols = ", ".join([f"`{c}`" for c in tgt_cols])
        extra_sql = f" {extra}" if extra else ""
        out.append(f"ALTER TABLE `{src_t}` ADD CONSTRAINT `{cname}` FOREIGN KEY ({q_src_cols}) REFERENCES `{tgt_t}` ({q_tgt_cols}){extra_sql};")
    out.append("")

    # Secondary Indexes
    out.append("-- =====================================================================")
    out.append("-- 5. SECONDARY INDEXES")
    out.append("-- =====================================================================")
    for unique, iname, tname, rest in sorted(indexes):
        uniq_str = "UNIQUE " if unique else ""
        
        # Clean index column definition
        # e.g. USING btree (property_id)
        # e.g. USING btree (voucher_id) WHERE (voucher_id IS NOT NULL)
        # e.g. USING btree (transaction_type, COALESCE(...))
        m_cols = re.search(r"\((.*?)\)", rest)
        if not m_cols:
            continue
            
        raw_cols = m_cols.group(1)
        # Parse column list cleanly
        clean_cols = []
        if iname in ("fin_transaction_account_rules_active_uniq", "fin_txn_rules_uq"):
            clean_cols = ["`transaction_type`", "`payment_method`", "`deposit_type`", "`pdc_type`"]
        else:
            for raw_c in raw_cols.split(","):
                raw_c = raw_c.strip()
                # If it's a function like COALESCE(col, ...)
                m_coalesce = re.search(r"COALESCE\s*\(\s*([a-zA-Z0-9_]+)", raw_c, re.IGNORECASE)
                if m_coalesce:
                    clean_cols.append(f"`{m_coalesce.group(1)}`")
                    continue
                # Normal column identifier
                col_extract = re.search(r"\b([a-zA-Z0-9_]+)\b", raw_c)
                if col_extract:
                    cname = col_extract.group(1)
                    if cname.lower() not in ("coalesce", "text", "null", "__null__", "using", "btree"):
                        clean_cols.append(f"`{cname}`")
                
        # If there's a WHERE clause with is_active = true, append is_active to index
        if "is_active" in rest.lower() and "`is_active`" not in clean_cols:
            clean_cols.append("`is_active`")
            
        idx_cols_sql = ", ".join(clean_cols)
        out.append(f"CREATE {uniq_str}INDEX `{iname}` ON `{tname}` ({idx_cols_sql});")
    out.append("")

    # View
    out.append("-- =====================================================================")
    out.append("-- 6. VIEWS")
    out.append("-- =====================================================================")
    out.append("CREATE OR REPLACE VIEW `v_posting_engine_compliance` AS")
    out.append("SELECT e.id AS event_id,")
    out.append("    e.event_type,")
    out.append("    e.source_type,")
    out.append("    e.status,")
    out.append("    l.line_number,")
    out.append("    l.account_code,")
    out.append("    l.debit,")
    out.append("    l.credit,")
    out.append("    CASE")
    out.append("        WHEN ((l.account_code IS NULL) OR (l.account_code = '')) THEN 'NO_CODE'")
    out.append("        WHEN (c.id IS NULL) THEN 'UNRESOLVED'")
    out.append("        WHEN (c.is_active = 0) THEN 'INACTIVE'")
    out.append("        WHEN (c.account_level = 'GL') THEN 'GL_ONLY'")
    out.append("        ELSE 'OK'")
    out.append("    END AS compliance_status")
    out.append("FROM ((`fin_accounting_events` e")
    out.append("    LEFT JOIN `fin_accounting_event_lines` l ON ((l.event_id = e.id)))")
    out.append("    LEFT JOIN `fin_coa_accounts` c ON (((c.account_code = l.account_code) AND (c.is_active = 1))));")
    out.append("")

    # Footer
    out.append("-- =====================================================================")
    out.append("-- 7. COMMIT & RESTORE FOREIGN KEY CHECKS")
    out.append("-- =====================================================================")
    out.append("COMMIT;")
    out.append("SET FOREIGN_KEY_CHECKS = 1;")
    out.append("")

    full_sql = "\n".join(out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(full_sql)

    print(f"Successfully generated MariaDB DDL at: {out_path}")
    print(f"Generated file size: {len(full_sql)} bytes, {len(out)} lines.")

if __name__ == "__main__":
    generate_mariadb_ddl(SRC_SQL, OUT_SQL)
