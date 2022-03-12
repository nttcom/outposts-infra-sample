import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export type ApplicationLoadBalancerProps = {
  customerOwnedIpAddressPoolId: string;
  subnetIds: string[];
  region?: string;
  securityGroupId?: string;
  name: string;
};
export class ApplicationLoadBalancer extends Construct {
  private readonly resource: cdk.CustomResource;

  constructor(
    scope: Construct,
    id: string,
    props: ApplicationLoadBalancerProps
  ) {
    super(scope, id);

    // ライフサイクルのハンドラを定義する
    const environment: lambda.FunctionProps["environment"] =
      props.region === undefined ? undefined : { REGION: props.region };
    const runtime = lambda.Runtime.NODEJS_14_X;
    const handler = new lambda.Function(this, "Handler", {
      code: lambda.Code.fromAsset(path.join(path.dirname(__dirname), "lambda")),
      runtime,
      timeout: cdk.Duration.minutes(15),
      handler: "index.handler",
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            "elasticloadbalancing:CreateLoadBalancer",
            "elasticloadbalancing:DeleteLoadBalancer",
            // customer owned IP address を ELB につける場合、
            // LoadBalancer デプロイ中に customer owned IP address の情報を
            // 必要とし、これら API を呼び出すため、 Lambda に権限をつけておく。
            "ec2:DescribeCoipPools",
            "ec2:GetCoipPoolUsage",
          ],
          resources: ["*"],
        }),
      ],
      environment,
    });

    // あとは custom resource を利用するボイラープレート
    const provider = new cr.Provider(this, "Provider", {
      onEventHandler: handler,
    });
    this.resource = new cdk.CustomResource(this, "Resource", {
      serviceToken: provider.serviceToken,
      properties: {
        subnetIds: props.subnetIds,
        coIpPoolId: props.customerOwnedIpAddressPoolId,
        securityGroupId: props.securityGroupId,
        name: props.name,
      },
    });
  }

  // 作成した load balancer の ARN は他のリソースから利用される場合があるため、
  // ref で参照できるようにする。
  public get ref(): string {
    return this.resource.ref;
  }
}
