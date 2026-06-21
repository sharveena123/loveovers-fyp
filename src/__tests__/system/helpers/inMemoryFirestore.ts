/**
 * In-memory implementation of the modular `firebase/firestore` API surface
 * used by the app's service layer.
 *
 * System tests swap the real Firestore for this fake via
 * `jest.mock("firebase/firestore", () => require("./helpers/inMemoryFirestore"))`
 * so complete buyer/seller workflows run end to end against one shared
 * "database" — no network, no emulator, fully deterministic.
 */

type DocData = Record<string, any>;

interface CollectionRef {
  __type: "collection";
  path: string;
}

interface DocRef {
  __type: "doc";
  collectionPath: string;
  id: string;
  path: string;
}

interface QueryConstraint {
  __type: "where" | "orderBy";
  field: string;
  op?: string;
  value?: any;
  direction?: "asc" | "desc";
}

interface QueryRef {
  __type: "query";
  collectionPath: string;
  constraints: QueryConstraint[];
}

// collectionPath -> (docId -> data)
const store = new Map<string, Map<string, DocData>>();
let autoId = 0;
let clockTick = 0;
const snapshotListeners = new Set<() => void>();

export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    // Monotonic tick keeps orderBy("createdAt") deterministic within one test.
    clockTick += 1;
    const millis = Date.now() + clockTick;
    return new Timestamp(Math.floor(millis / 1000), (millis % 1000) * 1e6);
  }

  static fromDate(date: Date): Timestamp {
    const millis = date.getTime();
    return new Timestamp(Math.floor(millis / 1000), (millis % 1000) * 1e6);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }
}

class IncrementFieldValue {
  constructor(public readonly amount: number) {}
}

/** Mirrors firebase/firestore's increment() sentinel. */
export function increment(amount: number): IncrementFieldValue {
  return new IncrementFieldValue(amount);
}

/** Replaces FieldValue sentinels with their resolved values before storing. */
function resolveFieldValues(existing: DocData | undefined, data: DocData): DocData {
  const out: DocData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof IncrementFieldValue) {
      const current = typeof existing?.[key] === "number" ? existing[key] : 0;
      out[key] = current + value.amount;
    } else {
      out[key] = clone(value);
    }
  }
  return out;
}

function getCollection(path: string): Map<string, DocData> {
  let col = store.get(path);
  if (!col) {
    col = new Map();
    store.set(path, col);
  }
  return col;
}

function nextId(): string {
  autoId += 1;
  return `auto-id-${autoId}`;
}

function notifyListeners() {
  for (const listener of [...snapshotListeners]) listener();
}

function clone<T>(value: T): T {
  if (value instanceof Timestamp) {
    return new Timestamp(value.seconds, value.nanoseconds) as unknown as T;
  }
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (Array.isArray(value)) return value.map(clone) as unknown as T;
  if (value && typeof value === "object") {
    const out: DocData = {};
    for (const [k, v] of Object.entries(value)) out[k] = clone(v);
    return out as T;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------

export function collection(_db: unknown, ...segments: string[]): CollectionRef {
  return { __type: "collection", path: segments.join("/") };
}

export function doc(
  parent: unknown,
  ...segments: string[]
): DocRef {
  // doc(collectionRef) / doc(collectionRef, id)
  if ((parent as CollectionRef)?.__type === "collection") {
    const colPath = (parent as CollectionRef).path;
    const id = segments[0] ?? nextId();
    return { __type: "doc", collectionPath: colPath, id, path: `${colPath}/${id}` };
  }
  // doc(db, ...pathSegments)
  const id = segments[segments.length - 1];
  const colPath = segments.slice(0, -1).join("/");
  return { __type: "doc", collectionPath: colPath, id, path: `${colPath}/${id}` };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function where(field: string, op: string, value: any): QueryConstraint {
  return { __type: "where", field, op, value };
}

export function orderBy(
  field: string,
  direction: "asc" | "desc" = "asc",
): QueryConstraint {
  return { __type: "orderBy", field, direction };
}

export function query(
  source: CollectionRef | QueryRef,
  ...constraints: QueryConstraint[]
): QueryRef {
  const base =
    (source as QueryRef).__type === "query"
      ? (source as QueryRef)
      : {
          __type: "query" as const,
          collectionPath: (source as CollectionRef).path,
          constraints: [],
        };
  return {
    __type: "query",
    collectionPath: base.collectionPath,
    constraints: [...base.constraints, ...constraints],
  };
}

function toComparable(value: any): number | string {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return value;
}

function runQuery(source: CollectionRef | QueryRef) {
  const collectionPath =
    (source as QueryRef).__type === "query"
      ? (source as QueryRef).collectionPath
      : (source as CollectionRef).path;
  const constraints =
    (source as QueryRef).__type === "query"
      ? (source as QueryRef).constraints
      : [];

  let entries = [...getCollection(collectionPath).entries()];

  for (const c of constraints) {
    if (c.__type !== "where") continue;
    entries = entries.filter(([, data]) => {
      const actual = toComparable(data[c.field]);
      const expected = toComparable(c.value);
      switch (c.op) {
        case "==":
          return actual === expected;
        case "!=":
          return actual !== expected;
        case ">":
          return actual > expected;
        case ">=":
          return actual >= expected;
        case "<":
          return actual < expected;
        case "<=":
          return actual <= expected;
        case "in":
          return Array.isArray(c.value) && c.value.includes(data[c.field]);
        default:
          throw new Error(`Unsupported where op: ${c.op}`);
      }
    });
  }

  for (const c of constraints) {
    if (c.__type !== "orderBy") continue;
    entries.sort(([, a], [, b]) => {
      const av = toComparable(a[c.field]);
      const bv = toComparable(b[c.field]);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return c.direction === "desc" ? -cmp : cmp;
    });
  }

  return entries.map(([id, data]) => ({
    id,
    ref: {
      __type: "doc" as const,
      collectionPath,
      id,
      path: `${collectionPath}/${id}`,
    },
    data: () => clone(data),
    exists: () => true,
  }));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getDoc(ref: DocRef) {
  const data = getCollection(ref.collectionPath).get(ref.id);
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : clone(data)),
  };
}

export async function getDocs(source: CollectionRef | QueryRef) {
  const docs = runQuery(source);
  return { docs, empty: docs.length === 0, size: docs.length };
}

export function onSnapshot(
  source: CollectionRef | QueryRef,
  callback: (snapshot: { docs: ReturnType<typeof runQuery> }) => void,
) {
  const emit = () => callback({ docs: runQuery(source) });
  snapshotListeners.add(emit);
  emit();
  return () => snapshotListeners.delete(emit);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function setDoc(
  ref: DocRef,
  data: DocData,
  options?: { merge?: boolean },
) {
  const col = getCollection(ref.collectionPath);
  const existing = options?.merge ? col.get(ref.id) : undefined;
  const resolved = resolveFieldValues(existing, data);
  if (existing) {
    col.set(ref.id, { ...existing, ...resolved });
  } else {
    col.set(ref.id, resolved);
  }
  notifyListeners();
}

export async function addDoc(colRef: CollectionRef, data: DocData) {
  const id = nextId();
  getCollection(colRef.path).set(id, clone(data));
  notifyListeners();
  return {
    __type: "doc" as const,
    collectionPath: colRef.path,
    id,
    path: `${colRef.path}/${id}`,
  };
}

export async function updateDoc(ref: DocRef, data: DocData) {
  const col = getCollection(ref.collectionPath);
  const existing = col.get(ref.id);
  if (existing === undefined) {
    throw new Error(`No document to update: ${ref.path}`);
  }
  col.set(ref.id, { ...existing, ...resolveFieldValues(existing, data) });
  notifyListeners();
}

export async function deleteDoc(ref: DocRef) {
  getCollection(ref.collectionPath).delete(ref.id);
  notifyListeners();
}

export function writeBatch(_db: unknown) {
  const ops: (() => Promise<void>)[] = [];
  return {
    set: (ref: DocRef, data: DocData, options?: { merge?: boolean }) => {
      ops.push(() => setDoc(ref, data, options));
    },
    update: (ref: DocRef, data: DocData) => {
      ops.push(() => updateDoc(ref, data));
    },
    delete: (ref: DocRef) => {
      ops.push(() => deleteDoc(ref));
    },
    commit: async () => {
      for (const op of ops) await op();
    },
  };
}

// ---------------------------------------------------------------------------
// Test utilities (not part of the Firestore API)
// ---------------------------------------------------------------------------

/** Wipes every collection between tests. */
export function __resetFirestore() {
  store.clear();
  snapshotListeners.clear();
  autoId = 0;
  clockTick = 0;
}

/** Raw read access for assertions: returns docId -> data for a collection. */
export function __getCollectionData(path: string): Map<string, DocData> {
  return getCollection(path);
}
