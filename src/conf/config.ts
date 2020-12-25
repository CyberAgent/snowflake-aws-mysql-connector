import * as fs from "fs";
import * as path from "path";

export interface Config {
  stackName: string;
  awsAccountId: string;
  awsRegion: string;
  lambdaFunctionName: string;
  lambdaEnvironmentVariables?: { [key: string]: string };
  vpcId: string;
  subnets: { id: string; availabilityZone: string }[];
  securityGroupIds: string[];
  snowflakeApiAwsIamUser: { arn: string; externalId: string }[];
  mysqlHost: string;
  mysqlUser: string;
  mysqlPassword: string;
  mysqlDatabase: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isConfig(config: any): config is Config {
  return config.stackName !== undefined;
}

export function getConfig(target: string, _basePath?: string): Config {
  let basePath;
  if (_basePath) {
    basePath = _basePath;
  } else {
    basePath = "../conf-file";
  }
  const filePath = path.resolve(__dirname, `${basePath}/${target}.json`);
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (isConfig(json)) {
    if (json.lambdaEnvironmentVariables) {
      json.lambdaEnvironmentVariables["STACK_ENV"] = target;
    } else {
      json.lambdaEnvironmentVariables = { STACK_ENV: target };
    }
    return json;
  } else {
    throw new Error("config type check failed");
  }
}
