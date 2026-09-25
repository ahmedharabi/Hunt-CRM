import { createDb } from "@/db/client";

/** Fresh in-memory database with every migration applied. */
export function testDb() {
  return createDb(":memory:");
}
