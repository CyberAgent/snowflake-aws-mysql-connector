import * as mysql2 from "mysql2/promise";
import * as config from "./conf/config";

export async function query(conf: config.Config, sql: string): Promise<any> {
  if (!sql.trim().toLowerCase().startsWith("select")) {
    throw new Error(`invalid sql. only support SELECT query. sql: ${sql}`);
  }
  const connection = await mysql2.createConnection({
    host: conf.mysqlHost,
    user: conf.mysqlUser,
    password: conf.mysqlPassword,
    database: conf.mysqlDatabase,
  });
  const [rows, _] = await connection.execute(sql);

  return rows;
}
