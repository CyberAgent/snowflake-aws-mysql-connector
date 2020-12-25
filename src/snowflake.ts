import * as zlib from "zlib";
import * as util from "util";

export interface SnowflakeResultSet {
  compress: string;
  encodedRecords: string;
}

export interface SnowflakeData {
  data: (number | SnowflakeResultSet)[][];
}

export async function createSnowflakeData(
  records: any
): Promise<SnowflakeData> {
  let compress = "none";
  const jsonStringRecords = JSON.stringify(records);
  if (jsonStringRecords.length > 100000) {
    compress = "zlib";
  }

  let encodedRecords: string;
  switch (compress) {
    case "zlib":
      encodedRecords = (
        await util.promisify<string, Buffer>(zlib.deflate)(jsonStringRecords)
      ).toString("base64");
      break;
    case "none":
      encodedRecords = jsonStringRecords;
      break;
    default:
      throw new Error(`invalid compress type ${compress}`);
  }

  const result = {
    data: [[0, { compress: compress, encodedRecords: encodedRecords }]],
  };
  return result;
}
