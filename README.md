# snowflake-aws-mysql-connector

## Install

### Copy configuration file

```bash
$ cp conf/example.json conf/production.json
```

### Edit configuration file

Edit `conf/production.json`.

|key|value|example|
|:--|:--|:--|
|stackName|Stack name of CloudFormation|prod-SnowflakeAWSMySQLConnector-Stack|
|awsAccountId|AWS account id to deploy (12 digits)|123456789012|
|awsRegion|AWS region to deploy|ap-northeast-1|
|lambdaFunctionName|AWS Lambda function name to deploy|prod-snowflake-aws-mysql-connector|
|vpcId|Amazon VPC id where Lambda functions to run|vpc-abcded12345abcdef|
|subnets|Subnets(id and availability zone name) where Lambda functions to run|[{"id": "subnet-abcdefghik1234567", "availabilityZone": "ap-northeast-1a"}, {"id": "subnet-lmnopqrstu8901234", "availabilityZone": "ap-northeast-1c"}]|
|securityGroupIds|Security group ids to attach Lambda's ENI|["sg-abcdef12345678901", "sg-ghijkl23456789012"]|
|snowflakeApiAwsIamUser|IAM User from Snowflake (This must be empty array first time)|[]|
|mysqlHost|MySQL hostname or ip to connect. VPC of Lambda function and MySQL must same.|my-rds.cluster-ro-abcde123abcd.ap-northeast-1.rds.amazonaws.com|
|mysqlUser|MySQL user|user1|
|mysqlPassword|MySQL password|password|

* ⚠️ snowflakeApiAwsIamUser must be empty array first time.

### Build Lambda function

```bash
$ cd path/to/snowflake-aws-mysql-connector/
$ npm install
$ npm run build:cdk
```

### Init CDK

```bash
$ cd path/to/snowflake-aws-mysql-connector/cdk/
$ npm install
$ npm run cdk -- bootstrap -c target=production
```

You can use `--profile` option if you use profile to switch account or role. (e.g. `npm run cdk -- --profile my-profile ...`)

### Check what to deploy

```bash
$ npm run cdk -- diff -c target=production
```

### Deploy Lambda function and API Gateway

```bash
$ npm run cdk -- deploy -c target=production
[snip]
Do you wish to deploy these changes (y/n)? y
```

### Check output value from CDK

Output example:

```
Outputs:
SnowflakeAWSMySQLConnectorStack.SnowflakeApiAllowedPrefixes = https://abcde12345.execute-api.ap-northeast-1.amazonaws.com/default/
SnowflakeAWSMySQLConnectorStack.SnowflakeApiAwsRoleArn = arn:aws:iam::123456789012:role/prod-snowflake-aws-mysql-connector-execution-role-for-snowflake
SnowflakeAWSMySQLConnectorStack.prodsnowflakeawsmysqlconnectorrestapiEndpoint2587587B = https://abcde12345.execute-api.ap-northeast-1.amazonaws.com/default/
```

`SnowflakeAWSMySQLConnectorStack.SnowflakeApiAllowedPrefixes` and `SnowflakeAWSMySQLConnectorStack.SnowflakeApiAwsRoleArn` are used later.

You can check these values on CloudFormation outputs of AWS Console.

### Integrate Snowflake and your AWS IAM role

Query on Snowflake. Maybe you should use role `ACCOUNTADMIN`;

|placeholder|value|example|
|:--|:--|:--|
|<integration\_name>|integration name|prod\_api\_gateway\_mysql|
|<iam_\role_arn>|SnowflakeAWSMySQLConnectorStack.SnowflakeApiAwsRoleArn|arn:aws:iam::123456789012:role/prod-snowflake-aws-mysql-connector-execution-role-for-snowflake|
|<api\_prefix>|SnowflakeAWSMySQLConnectorStack.SnowflakeApiAllowedPrefixes|https://abcde12345.execute-api.ap-northeast-1.amazonaws.com/default/|

```sql
create or replace api integration <integration_name>
  api_provider = aws_api_gateway
  api_aws_role_arn = '<iam_role_arn>'
  enabled = true
  api_allowed_prefixes = ('<api_prefix>')
;
```

### Update configuration

Query on Snowflake to get `API_AWS_IAM_USER_ARN` and `API_AWS_EXTERNAL_ID`.

|placeholder|value|example|
|:--|:--|:--|
|<integration\_name>|integration name|prod\_api\_gateway\_mysql|

```sql
describe api integration <integration_name>;
```

Update `conf/production.json`.

|placeholder|example|
|:--|:--|
|<API\_AWS\_IAM\_USER\_ARN>|arn:aws:iam::987654321098:user/abcdef-abcd1234|
|<API\_AWS\_EXTERNAL\_ID>|AbCdEfGh12345=|

|key|value|example|
|:--|:--|:--|
|snowflakeApiAwsIamUser|Update with `API_AWS_IAM_USER_ARN` and `API_AWS_EXTERNAL_ID`|[{"arn": "<API\_AWS\_IAM\_USER\_ARN>", "externalId": "<API\_AWS\_EXTERNAL\_ID>"}]|

### Build Lambda function

```bash
$ cd path/to/snowflake-aws-mysql-connector/
$ npm install
$ npm run build:cdk
```

### Check what to deploy

```bash
$ npm run cdk -- diff -c target=production
```

### Deploy Lambda function and API Gateway

```bash
$ npm run cdk -- deploy -c target=production
[snip]
Do you wish to deploy these changes (y/n)? y
```

### Create Snowflake External Function

|placeholder|value|example|
|:--|:--|:--|
|<external\_function_name>|external function name|prod\_call\_api\_gateway\_mysql|
|<integration\_name>|integration name|prod\_api\_gateway\_mysql|
|<api\_prefix>|SnowflakeAWSMySQLConnectorStack.SnowflakeApiAllowedPrefixes|https://abcde12345.execute-api.ap-northeast-1.amazonaws.com/default/|

```sql
create or replace external function <external_function_name>(q string)
  returns variant
  api_integration = <integration_name>
  max_batch_rows = 1
  as '<api_prefix>'
;
```

### Create Snowflake User Defined Function(UDF)

|placeholder|value|example|
|:--|:--|:--|
|<function\_name>|udf name|mysql\_query|
|<external\_function\_name>|external function name|prod\_call\_api\_gateway\_mysql|
```sql
create or replace function <function_name>(q string)
    returns table(value variant)
    as '
select value from
  table(flatten(input =>
    case <external_function_name>(q):compress
      when \'zlib\' then parse_json(decompress_string(base64_decode_binary(<external_function_name>(q):encodedRecords), \'zlib\'))
      else parse_json(<external_function_name>(q):encodedRecords)
    end
  ))
';
```

## Usage

```sql
-- select all
select * from table(query_mysql('select * from my_table'));

-- select specific columns
select value:id, value:name from table(query_mysql('select id, name from users'));

-- join with Snowflake table and MySQL table
select log.user_id, users.value:name
from
  log  left join table(query_mysql('select id, name from users')) as users
  on
    log.user_id = users.value:id
limit 10;
```
