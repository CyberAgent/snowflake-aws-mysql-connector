#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import {
  SnowflakeAWSMySQLConnectorStack,
  SnowflakeAWSMySQLConnectorStackProps,
} from "../lib/snowflake-aws-mysql-connector-stack";
import * as config from "../../src/conf/config";

const app = new cdk.App();
const target = app.node.tryGetContext("target") as string;
if (!target) throw new Error("Invalid target environment");
const conf = config.getConfig(target, "../../conf");
const env = { account: conf.awsAccountId, region: conf.awsRegion };

const props: SnowflakeAWSMySQLConnectorStackProps = {
  config: conf,
  stackName: conf.stackName,
  lambdaAssetPath: "../dist/app/",
  lambdaLayerAssetPath: "../dist/lambda-layer/",
  env,
};
new SnowflakeAWSMySQLConnectorStack(
  app,
  "SnowflakeAWSMySQLConnectorStack",
  props
);
