import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export type CustomerOwnedIpAddressPoolAttachmentProps = {
  customerOwnedIpAddressPoolId: string;
  subnetId: string;
  region?: string;
};
export class CustomerOwnedIpAddressPoolAttachment extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: CustomerOwnedIpAddressPoolAttachmentProps
  ) {
    super(scope, id);

    // ライフサイクルのハンドラを定義する
    const environment: lambda.FunctionProps["environment"] =
      props.region === undefined ? undefined : { REGION: props.region };
    const runtime = lambda.Runtime.NODEJS_14_X;
    const handler = new lambda.Function(this, "Handler", {
      code: lambda.Code.fromAsset(path.join(path.dirname(__dirname), "lambda")),
      runtime,
      timeout: cdk.Duration.minutes(3),
      handler: "index.handler",
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["ec2:ModifySubnetAttribute"],
          resources: ["*"],
        }),
      ],
      environment,
    });

    // あとは custom resource を利用するボイラープレート
    const provider = new cr.Provider(this, "Provider", {
      onEventHandler: handler,
    });
    new cdk.CustomResource(this, "Resource", {
      serviceToken: provider.serviceToken,
      properties: {
        subnetId: props.subnetId,
        coIpPoolId: props.customerOwnedIpAddressPoolId,
      },
    });
  }
}
