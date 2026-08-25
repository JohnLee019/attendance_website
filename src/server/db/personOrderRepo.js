import { pool } from "./connection.js";

// 엑셀 이름 순서를 아직 정하지 않은 사람에게 좌석번호 순서를 기본값으로 채운다.
// 새로 추가된 사람만 NULL 이므로, 이미 정해둔 순서를 덮어쓰지 않는다.
export async function backfillPersonOrder() {
  await pool.query(`
    UPDATE Person p
    SET sortOrder = s.seatNo
    FROM Seat s
    WHERE s.personId = p.id
      AND p.sortOrder IS NULL
  `);
}

// 순서 편집 화면용 목록. 순서를 정하지 않은 사람은 맨 뒤로.
export async function getPersonOrder() {
  const { rows } = await pool.query(`
    SELECT
      p.id AS "personId",
      p.name AS "name",
      s.seatNo AS "seatNo"
    FROM Person p
    JOIN Seat s ON s.personId = p.id
    WHERE p.name <> ''
    ORDER BY p.sortOrder NULLS LAST, s.seatNo
  `);

  return rows;
}

// 화면에 보이는 순서 그대로 1,2,3... 을 다시 매긴다.
// 중간에 사람이 빠지거나 늘어도 번호가 어긋나지 않게 매번 전체를 다시 쓴다.
export async function savePersonOrder(personIds) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (let i = 0; i < personIds.length; i++) {
      await client.query(
        `UPDATE Person SET sortOrder = $1 WHERE id = $2`,
        [i + 1, Number(personIds[i])]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
