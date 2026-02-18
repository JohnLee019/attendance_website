const TOTAL_SEATS = 60;
const COLS_PER_ROW = 10;

export const SEED_SEATS = Array.from(
  { length: TOTAL_SEATS },
  (_, i) => {
    const seatNo = i + 1;
    const r = Math.floor(i / COLS_PER_ROW) + 1;
    const c = (i % COLS_PER_ROW) + 1;

    return {
      seatNo,
      r,
      c,
      rs: 1,
      cs: 1,
    };
  }
);
