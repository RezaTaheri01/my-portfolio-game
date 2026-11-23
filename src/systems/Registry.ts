/**
 * A tiny keyed registry. Used wherever "a new kind of X" should be addable
 * without editing the code that consumes X (entity kinds, item types, ...).
 *
 *   const things = new Registry<ThingFactory>("thing");
 *   things.register("lamp", makeLamp);
 *   things.require("lamp")   // throws a helpful error if the kind is unknown
 */
export class Registry<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly label: string) {}

  register(kind: string, value: T): void {
    if (this.entries.has(kind)) {
      console.warn(`[Registry] ${this.label} "${kind}" registered twice; the later one wins.`);
    }
    this.entries.set(kind, value);
  }

  get(kind: string): T | undefined {
    return this.entries.get(kind);
  }

  require(kind: string): T {
    const value = this.entries.get(kind);
    if (value === undefined) {
      const known = [...this.entries.keys()].join(", ") || "(none)";
      throw new Error(`Unknown ${this.label} "${kind}". Registered: ${known}`);
    }
    return value;
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }
}
