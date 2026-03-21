let isDbReady = false;
let isInitializing = false;

import { initSchema } from "./db/schema.js";
import { seedSeatsIfEmpty } from "./db/seed.js";

export async function ensureDbReady() {
  if (isDbReady) return;

  if (isInitializing) {
    while (!isDbReady) {
      await new Promise(res => setTimeout(res, 100));
    }
    return;
  }

  try {
    isInitializing = true;
    console.log("DB init start");

    await initSchema();
    await seedSeatsIfEmpty();

    isDbReady = true;
    console.log("DB init complete");
  } catch (err) {
    console.error("DB init failed:", err);
  } finally {
    isInitializing = false;
  }
}