import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";

export async function getAllUserNamesForApp() {
  try {
    const db = getDb();
    const rows = await db
      .select({ name: users.name })
      .from(users)
      .orderBy(asc(users.name));

    return rows.map((row) => row.name);
  } catch {
    return [];
  }
}
