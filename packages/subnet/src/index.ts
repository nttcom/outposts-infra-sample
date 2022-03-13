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
      code: lambda.Code.fromAsset(
        path.join(path.dirname(__dirname), "lambda"),
        // TypeScript コードは Node.js が解釈できるコードへ変換しなければならないので、
        // この関数のデプロイをフックして、先にビルドしておく必要がある。
        // なお、最初にビルドしたコードを S3 に設置するようになっており、
        // S3 に設置先バケットがなければエラーになる。
        // この場合、 `cdk bootstrap` コマンドを最初に実行しておくことで作成される。
        {
          assetHashType: cdk.AssetHashType.OUTPUT,
          bundling: {
            image: runtime.bundlingImage,
            user: "root",
            command: [
              "bash",
              "-c",
              "-O",
              "extglob",
              [
                "mkdir -p /build",
                "cp !(.|..|node_modules) /build",
                "cd /build",
                "npx pnpm install",
                "npx tsc -p .",
                "mkdir -p /asset-output",
                "cp index.js /asset-output",
              ].join(" && "),
            ],
          },
        }
      ),
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
