import * as lambda from "aws-lambda";
import * as aws from "aws-sdk";

// ModifySubnetAttribute を呼び出すためのクライアントを初期化しておく
const elb = new aws.ELBv2({
  // リージョンは環境変数として定義してもらう必要がある。
  region: process.env.REGION,
});

type ApplicationLoadBalancerProps = {
  securityGroupId: string;
  coIpPoolId: string;
  subnetIds: string[];
  name: string;
};
type ApplicationLoadBalancerAttribute = {
  arn: string;
};
const createApplicationLoadBalancer = async (
  props: ApplicationLoadBalancerProps
): Promise<ApplicationLoadBalancerAttribute> => {
  const resp = await elb
    .createLoadBalancer({
      SecurityGroups: [props.securityGroupId],
      Subnets: props.subnetIds,
      CustomerOwnedIpv4Pool: props.coIpPoolId,
      Name: props.name,
    })
    .promise();
  if (resp.LoadBalancers === undefined) {
    throw new Error("cannot find created load balancer");
  }
  switch (resp.LoadBalancers.length) {
    case 0:
      throw new Error("cannot find created load balancer");
    case 1:
      break;
    default:
      throw new Error("multiple load balancer created");
  }
  const alb = resp.LoadBalancers[0];

  if (alb.LoadBalancerArn === undefined) {
    throw new Error("cannot get load balancer arn");
  }
  return {
    arn: alb.LoadBalancerArn,
  };
};

const isStringArray = (arg: unknown): arg is string[] =>
  Array.isArray(arg) && arg.every((e) => typeof e === "string");

const createHandler = async (
  event:
    | lambda.CloudFormationCustomResourceCreateEvent
    | lambda.CloudFormationCustomResourceUpdateEvent
): Promise<lambda.CloudFormationCustomResourceResponse> => {
  const { securityGroupId, coIpPoolId, subnetIds, name } =
    event.ResourceProperties;
  try {
    if (typeof securityGroupId !== "string") {
      throw new Error(
        `securityGroupId type is not string: ${typeof securityGroupId}`
      );
    }
    if (typeof coIpPoolId !== "string") {
      throw new Error(`coIpPoolId type is not string: ${typeof coIpPoolId}`);
    }
    if (!isStringArray(subnetIds)) {
      throw new Error("subnetIds type is not string[]");
    }
    if (typeof name !== "string") {
      throw new Error(`name type is not string: ${typeof name}`);
    }

    const alb = await createApplicationLoadBalancer({
      securityGroupId,
      coIpPoolId,
      subnetIds,
      name,
    });
    return {
      Status: "SUCCESS",
      StackId: event.StackId,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: alb.arn,
      RequestId: event.RequestId,
    };
  } catch (error) {
    return {
      Status: "FAILED",
      StackId: event.StackId,
      LogicalResourceId: event.LogicalResourceId,
      Reason: JSON.stringify(error),
      // Create イベントのときは PhysicalResourceId は何を返してもいいので空文字列を返す。
      // 一方、 Update イベントのときは前回作成した PhysicalResourceId を返す必要がある。
      PhysicalResourceId:
        event.RequestType === "Create" ? "" : event.PhysicalResourceId,
      RequestId: event.RequestId,
    };
  }
};

const deleteHandler = async (
  event: lambda.CloudFormationCustomResourceDeleteEvent
): Promise<lambda.CloudFormationCustomResourceResponse> => {
  try {
    await elb
      .deleteLoadBalancer({
        LoadBalancerArn: event.PhysicalResourceId,
      })
      .promise();
    return {
      Status: "SUCCESS",
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: event.PhysicalResourceId,
      StackId: event.StackId,
    };
  } catch (error) {
    return {
      Status: "FAILED",
      Reason: JSON.stringify(error),
      StackId: event.StackId,
      PhysicalResourceId: event.PhysicalResourceId,
      LogicalResourceId: event.LogicalResourceId,
      RequestId: event.RequestId,
    };
  }
};

export const handler = async (
  event: lambda.CloudFormationCustomResourceEvent
): Promise<lambda.CloudFormationCustomResourceResponse> => {
  switch (event.RequestType) {
    case "Create":
    case "Update":
      // Create イベントでも Update イベントでも Load Balancer を
      // つくるだけでいいので差分がほどんとないので関数化している。
      return createHandler(event);
    case "Delete":
      return deleteHandler(event);
  }

  // ここまでで全てのイベントを処理しているため、ここに来ることはない。
  // ここに来ているということは、 AWS 側で仕様が更新され、カスタムリソースに
  // あたらしいライフサイクルが加わったということを示している。
  // なので、それを補足してエラーレスポンスとして返し、 CloudFormation 側でエラーとしておくことで。
  // デプロイ時にその仕様変更を気付けるようにしておく.
  const requestId = (event as lambda.CloudFormationCustomResourceEvent)
    .RequestId;
  const stackId = (event as lambda.CloudFormationCustomResourceEvent).StackId;
  const requestType: string = (
    event as lambda.CloudFormationCustomResourceEvent
  ).RequestType;
  const logicalResourceId = (event as lambda.CloudFormationCustomResourceEvent)
    .LogicalResourceId;
  return {
    RequestId: requestId,
    Status: "FAILED",
    StackId: stackId,
    Reason: `unknown event: ${requestType}`,
    LogicalResourceId: logicalResourceId,
    PhysicalResourceId: "",
  };
};
