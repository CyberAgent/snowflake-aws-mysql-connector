import * as lambda from "aws-lambda";
import * as config from "./conf/config";
import * as snowflake from "./snowflake";
import * as mysql from "./mysql";

exports.handler = async function (
  event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  context: lambda.Context // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  let invokeError: Error | null | string = null;
  let snowflakeData: snowflake.SnowflakeData | null = null;
  try {
    console.log(JSON.stringify(event));
    const stackEnv = process.env.STACK_ENV;
    let conf;
    if (stackEnv) {
      conf = config.getConfig(stackEnv);
    } else {
      throw new Error("environment variable 'STACK_ENV' not found");
    }

    const sql = JSON.parse(event.body).data[0][1];
    const resultRows = await mysql.query(conf, sql);
    snowflakeData = await snowflake.createSnowflakeData(resultRows);
  } catch (e) {
    console.error(`function failed.`, e);
    invokeError = e;
  }

  const result = {
    statusCode: 200,
    body: JSON.stringify(snowflakeData),
  };

  const promise = new Promise(function (resolve, reject) {
    if (invokeError) {
      reject(invokeError);
    } else {
      resolve(result);
    }
  });
  return promise;
};
