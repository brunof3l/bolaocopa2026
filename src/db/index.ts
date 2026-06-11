import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao definida.");
  }

  return databaseUrl;
}

export function getDb() {
  const client = neon(getDatabaseUrl());

  return drizzle({
    client,
    schema,
  });
}

export { schema };
