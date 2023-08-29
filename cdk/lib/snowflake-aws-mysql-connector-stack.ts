import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import { Config } from "../../src/conf/config";
import { Construct } from "constructs";

export interface SnowflakeAWSMySQLConnectorStackProps extends cdk.StackProps {
  readonly config: Config;
  readonly lambdaAssetPath: string;
  readonly lambdaLayerAssetPath: string;
}

export class SnowflakeAWSMySQLConnectorStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SnowflakeAWSMySQLConnectorStackProps
  ) {
    super(scope, id, props);

    const lambdaVpc = ec2.Vpc.fromLookup(
      this,
      `${props.config.lambdaFunctionName}-vpc`,
      { vpcId: props.config.vpcId }
    );

    const lambdaSubnets: ec2.ISubnet[] = [];
    for (const s of props.config.subnets) {
      const subnet = ec2.Subnet.fromSubnetAttributes(
        this,
        `${props.config.lambdaFunctionName}-subnet`,
        {
          subnetId: s.id,
          availabilityZone: s.availabilityZone,
        }
      );
      lambdaSubnets.push(subnet);
    }

    const lambdaSecurityGroups: ec2.ISecurityGroup[] = [];
    for (const i in props.config.securityGroupIds) {
      const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(
        this,
        `${props.config.lambdaFunctionName}-security-group`,
        props.config.securityGroupIds[i]
      );
      lambdaSecurityGroups.push(securityGroup);
    }

    const lambdaLayer = new lambda.LayerVersion(
      this,
      `${props.config.lambdaFunctionName}-layer`,
      {
        code: lambda.AssetCode.fromAsset(props.lambdaLayerAssetPath),
        compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      }
    );
    const lambdaFunction = new lambda.Function(
      this,
      props.config.lambdaFunctionName,
      {
        functionName: props.config.lambdaFunctionName,
        code: lambda.Code.fromAsset(props.lambdaAssetPath),
        layers: [lambdaLayer],
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_16_X,
        timeout: cdk.Duration.seconds(10),
        logRetention: logs.RetentionDays.THREE_DAYS,
        environment: props.config.lambdaEnvironmentVariables,
        vpc: lambdaVpc,
        vpcSubnets: lambdaVpc.selectSubnets({ subnets: lambdaSubnets }),
        securityGroups: lambdaSecurityGroups,
        allowPublicSubnet: true,
      }
    );

    const snowflakePrincipals: iam.PrincipalBase[] = [];
    const snowflakeExternalIds: string[] = [];
    const externalIds: Set<string> = new Set();
    const arns: Set<string> = new Set();
    for (const user of props.config.snowflakeApiAwsIamUser) {
      arns.add(user.arn);
      externalIds.add(user.externalId);
    }
    for (const arn of arns) {
      const principal = new iam.ArnPrincipal(arn);
      snowflakePrincipals.push(principal);
    }
    snowflakeExternalIds.push(...Array.from(externalIds));

    if (snowflakePrincipals.length == 0) {
      snowflakePrincipals.push(new iam.ServicePrincipal("ec2.amazonaws.com"));
    }
    if (snowflakeExternalIds.length == 0) {
      snowflakeExternalIds.push(
        "please fill in snowflakeApiAwsIamUser. this is filler value to avoid errors."
      );
    }

    const snowflakeRole = new iam.Role(
      this,
      `${props.config.lambdaFunctionName}-snowflake-role`,
      {
        roleName: `${props.config.lambdaFunctionName}-execution-role-for-snowflake`,
        assumedBy: new iam.CompositePrincipal(...snowflakePrincipals),
        externalIds: snowflakeExternalIds,
      }
    );

    const apiPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources: ["execute-api:/*/POST/*"],
      principals: [
        new iam.ArnPrincipal(
          `arn:aws:sts::${props.config.awsAccountId}:assumed-role/${snowflakeRole.roleName}/snowflake`
        ),
      ],
    });
    const apiPolicy = new iam.PolicyDocument({
      statements: [apiPolicyStatement],
    });

    const restApi = new apigateway.RestApi(
      this,
      `${props.config.lambdaFunctionName}-rest-api`,
      {
        restApiName: `${props.config.lambdaFunctionName}-rest-api`,
        description: "Managed by CloudFormation (CDK)",
        endpointTypes: [apigateway.EndpointType.REGIONAL],
        deployOptions: { stageName: "default" },
        policy: apiPolicy,
      }
    );

    const integration = new apigateway.LambdaIntegration(lambdaFunction);
    const resouse = restApi.root;
    resouse.addMethod("POST", integration, {
      authorizationType: apigateway.AuthorizationType.IAM,
    });

    new cdk.CfnOutput(this, "SnowflakeApiAllowedPrefixes", {
      value: restApi.url,
      description: "api_allowed_prefixes",
    });
    new cdk.CfnOutput(this, "SnowflakeApiAwsRoleArn", {
      value: snowflakeRole.roleArn,
      description: "api_aws_role_arn",
    });
  }
}
