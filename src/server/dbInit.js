import { initSchema } from "./db/schema.js";
import { seedSeatsIfEmpty } from "./db/seed.js";
import { ensureMailLogBaseline } from "./db/mailLogRepo.js";
import { backfillPersonOrder } from "./db/personOrderRepo.js";

let readyPromise = null;

export function ensureDbReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      console.log("DB init start");
      await initSchema();
      await seedSeatsIfEmpty();
      await backfillPersonOrder();
      await ensureMailLogBaseline();
      console.log("DB init complete");
    })().catch(err => {
      readyPromise = null;   // 실패하면 다음 요청이 다시 시도
      throw err;
    });
  }

  return readyPromise;
}