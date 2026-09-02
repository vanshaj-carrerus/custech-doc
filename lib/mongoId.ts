export const MONGO_ID_RE = /^[a-fA-F0-9]{24}$/;

export function isMongoId(value: unknown): value is string {
  return typeof value === "string" && MONGO_ID_RE.test(value);
}
