// server/lib/coerce.ts
// Prisma DateTime fields need a full ISO timestamp. The UI sends plain dates ("2026-11-21"),
// so date-only strings are converted for DateTime fields. Other values are left as they are.
import { Prisma } from '@prisma/client';

const dateTimeFields: Record<string, Set<string>> = {};
// Optional string fields: an empty string is stored as NULL, so unique columns (e.g. email) don't collide on "".
const optionalStringFields: Record<string, Set<string>> = {};
// String columns (e.g. JSON-in-LongText `metadata`): the UI sends objects, Prisma only accepts strings.
const stringFields: Record<string, Set<string>> = {};
// Numeric id columns: the browser sends ids as strings ("7"), but Prisma rejects a string for an Int/BigInt filter.
const intFields: Record<string, Set<string>> = {};
const bigIntFields: Record<string, Set<string>> = {};
for (const m of ((Prisma as any).dmmf?.datamodel?.models ?? []) as any[]) {
  dateTimeFields[m.name] = new Set(m.fields.filter((f: any) => f.type === 'DateTime').map((f: any) => f.name));
  intFields[m.name] = new Set(m.fields.filter((f: any) => f.type === 'Int').map((f: any) => f.name));
  bigIntFields[m.name] = new Set(m.fields.filter((f: any) => f.type === 'BigInt').map((f: any) => f.name));
  stringFields[m.name] = new Set(m.fields.filter((f: any) => f.type === 'String' && !f.isList).map((f: any) => f.name));
  optionalStringFields[m.name] = new Set(
    m.fields.filter((f: any) => f.type === 'String' && !f.isRequired && !f.isList).map((f: any) => f.name)
  );
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function coerceRow(modelName: string, row: any) {
  const fields = dateTimeFields[modelName];
  const optional = optionalStringFields[modelName];
  if (!fields || !row || typeof row !== 'object') return row;
  const out: Record<string, any> = { ...row };
  for (const key of Object.keys(out)) {
    if (fields.has(key) && typeof out[key] === 'string' && DATE_ONLY.test(out[key])) {
      out[key] = `${out[key]}T00:00:00.000Z`;
    }
    if (stringFields[modelName]?.has(key) && out[key] !== null && typeof out[key] === 'object' && !(out[key] instanceof Date)) {
      out[key] = JSON.stringify(out[key]);
    }
    if (optional?.has(key) && out[key] === '') {
      out[key] = null;
    }
  }
  return out;
}

// Filters ({ col: { in: [...] } }, { gte: ... }) must keep their operator objects. coerceRow() would
// JSON-stringify them for String columns (meant for JSON values being written), so `.in()` on a
// text column such as leases.lease_status silently matched nothing.
export function coerceWhere(modelName: string, where: any) {
  const dates = dateTimeFields[modelName];
  const ints = intFields[modelName];
  const bigs = bigIntFields[modelName];
  if (!where || typeof where !== 'object' || Array.isArray(where)) return where;
  const out: Record<string, any> = { ...where };
  const conv = (key: string, v: any) => {
    if (typeof v !== 'string') return v;
    if (dates?.has(key) && DATE_ONLY.test(v)) return `${v}T00:00:00.000Z`;
    if (ints?.has(key) && /^-?\d+$/.test(v)) return Number(v);
    if (bigs?.has(key) && /^-?\d+$/.test(v)) return BigInt(v);
    return v;
  };
  for (const key of Object.keys(out)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const v = out[key];
      out[key] = Array.isArray(v) ? v.map((x) => coerceWhere(modelName, x)) : coerceWhere(modelName, v);
      continue;
    }
    if (!dates?.has(key) && !ints?.has(key) && !bigs?.has(key)) continue;
    const v = out[key];
    if (typeof v === 'string') out[key] = conv(key, v);
    else if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      const o: Record<string, any> = { ...v };
      for (const op of ['equals', 'gt', 'gte', 'lt', 'lte', 'not']) if (typeof o[op] === 'string') o[op] = conv(key, o[op]);
      if (Array.isArray(o.in)) o.in = o.in.map((x: any) => conv(key, x));
      out[key] = o;
    }
  }
  return out;
}

export function coerceForModel(modelName: string, data: any) {
  return Array.isArray(data) ? data.map((r) => coerceRow(modelName, r)) : coerceRow(modelName, data);
}

// Relation joins from a select string, e.g. "*, departments(name), designations(title)".
// Only real Prisma relations are included, and only fields that exist on the related model.
const modelDefs: Record<string, any> = {};
for (const m of ((Prisma as any).dmmf?.datamodel?.models ?? []) as any[]) modelDefs[m.name] = m;

export function buildIncludeFromSelect(modelName: string, selectStr: any): Record<string, any> | undefined {
  if (typeof selectStr !== 'string' || !selectStr.includes('(')) return undefined;
  const model = modelDefs[modelName];
  if (!model) return undefined;
  const include: Record<string, any> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^()]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(selectStr))) {
    const relName = m[1];
    const relField = model.fields.find((f: any) => f.kind === 'object' && f.name === relName);
    if (!relField) continue;
    const related = modelDefs[relField.type];
    if (!related) continue;
    const scalars = new Set(related.fields.filter((f: any) => f.kind !== 'object').map((f: any) => f.name));
    const wanted = m[2].split(',').map((x) => x.trim()).filter((x) => scalars.has(x));
    include[relName] = wanted.length ? { select: Object.fromEntries(wanted.map((f) => [f, true])) } : true;
  }
  return Object.keys(include).length ? include : undefined;
}
