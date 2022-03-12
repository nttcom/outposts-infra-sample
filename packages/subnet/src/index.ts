import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export type CustomerOwnedIpAddressPoolAttachmentProps = {
  customerOwnedIpAddressPoolId: string;
  subnetId: string;
}
export class CustomerOwnedIpAddressPoolAttachment extends Construct {
  constructor(scope: Construct, id: string, props: CustomerOwnedIpAddressPoolAttachmentProps) {
    super(scope, id);

    const runtime = lambda.Runtime.NODEJS_14_X;
    const handler = new lambda.Function(this, "Handler", {
      code: lambda.Code.fromAsset(path.join(__dirname, "handler")),
      runtime,
      timeout: cdk.Duration.minutes(3),
      handler: 'index.handler',
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["ec2:ModifySubnetAttribute"],
          resources: ["*"]
        })
      ],
    });
  }
}
