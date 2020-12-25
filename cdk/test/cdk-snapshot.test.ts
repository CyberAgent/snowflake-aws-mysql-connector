import { SynthUtils } from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import * as SnowflakeAWSMySQLConnector from "../lib/snowflake-aws-mysql-connector-stack";
import * as config from "../../src/conf/config";
import { SnowflakeAWSMySQLConnectorStackProps } from "../lib/snowflake-aws-mysql-connector-stack";

test("Snapshot Test", () => {
  const app = new cdk.App();
  const conf = config.getConfig("snapshot-test", "../../cdk/test/conf");
  const props: SnowflakeAWSMySQLConnectorStackProps = {
    config: conf,
    stackName: conf.stackName,
    lambdaAssetPath: "test/empty",
    lambdaLayerAssetPath: "test/empty",
    env: { region: conf.awsRegion, account: conf.awsAccountId },
  };
  // WHEN
  const stack = new SnowflakeAWSMySQLConnector.SnowflakeAWSMySQLConnectorStack(
    app,
    "SnowflakeAWSMySQLConnectorTestStack",
    props
  );
  // THEN
  const cloudFormation = SynthUtils.toCloudFormation(stack);
  expect(cloudFormation).toMatchSnapshot();
});
