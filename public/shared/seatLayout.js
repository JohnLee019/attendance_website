// 좌석 배치도 블록 정의.
//
// 오늘 화면(main.js)과 과거 조회 화면(history.js)이 같은 배치를 그려야 한다.
// 예전에는 두 파일에 같은 배열이 복붙돼 있어서, 좌석을 바꾸면 한쪽만 고쳐지고
// 두 화면이 어긋날 위험이 있었다. 배치를 바꿀 일이 생기면 여기만 고치면 된다.
export const SEAT_BLOCKS = [

  { seats: [1, 2, 3, 4, 5, 6],                     grid: { r: 2,  c: 2,  rs: 6, cs: 6  }, wide: false },
  { seats: [7, 8, 9, 10, 11, 12],                  grid: { r: 2,  c: 10, rs: 6, cs: 6  }, wide: false },
  { seats: [13, 14, 15, 16, 59, 17, 18, 60],       grid: { r: 2,  c: 18, rs: 4, cs: 12 }, wide: true  },

  { seats: [19, 20, 21, 22, 23, 24],               grid: { r: 10, c: 2,  rs: 6, cs: 6  }, wide: false },
  { seats: [25, 26, 27, 28, 29, 30],               grid: { r: 10, c: 10, rs: 6, cs: 6  }, wide: false },
  { seats: [31, 32, 33, 34, 35, 36, 37, 38],       grid: { r: 11, c: 18, rs: 4, cs: 12 }, wide: true  },

  { seats: [39, 40, 41, 42, 43, 44],               grid: { r: 18, c: 2,  rs: 6, cs: 6  }, wide: false },
  { seats: [45, 46, 47, 48, 49, 50],               grid: { r: 18, c: 10, rs: 6, cs: 6  }, wide: false },
  { seats: [51, 52, 53, 54, 55, 56, 57, 58],       grid: { r: 20, c: 18, rs: 4, cs: 12 }, wide: true  }

];
