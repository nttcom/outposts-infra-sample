import * as lambda from 'aws-lambda';
import * as aws from 'aws-sdk';

// ModifySubnetAttribute を呼び出すためのクライアントを初期化しておく
const ec2 = new aws.EC2({
  // リージョンは環境変数として定義してもらう必要がある。
  region: process.env.REGION,
});

// ModifySubnetAttribute を呼び出して CoIP を設定するように subnet の設定を変更する。
export const modifySubnetConfig = async (
  event:
    | lambda.CloudFormationCustomResourceCreateEvent
    | lambda.CloudFormationCustomResourceUpdateEvent,
): Promise<lambda.CloudFormationCustomResourceResponse> => {
  const { subnetId, coIpPoolId } = event.ResourceProperties;
  try {
    if (typeof subnetId !== 'string') {
      throw new Error(`subnetId type is not string: ${typeof subnetId}`);
    }
    if (typeof coIpPoolId !== 'string') {
      throw new Error(`coIpPoolId type is not string: ${typeof coIpPoolId}`);
    }

    const param: aws.EC2.ModifySubnetAttributeRequest = {
      SubnetId: subnetId,
      MapCustomerOwnedIpOnLaunch: {
        Value: true,
      },
      CustomerOwnedIpv4Pool: coIpPoolId,
    };
    await ec2.modifySubnetAttribute(param).promise();

    return {
      RequestId: event.RequestId,
      StackId: event.StackId,
      Status: 'SUCCESS',
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: `${subnetId}:${coIpPoolId}`,
    };
  } catch (error) {
    return {
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: '',
      StackId: event.StackId,
      Status: 'FAILED',
      Reason: JSON.stringify(error),
    };
  }
};

export const handler = async (
  event: lambda.CloudFormationCustomResourceEvent,
): Promise<lambda.CloudFormationCustomResourceResponse> => {
  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      // coip pool id か subnet id が変わったときのみ subnet の設定変更が必要となる。
      return modifySubnetConfig(event);
    case 'Delete':
      return {
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        PhysicalResourceId: event.PhysicalResourceId,
        StackId: event.StackId,
        Status: 'SUCCESS',
      };
  }

  // ここまでで全てのイベントを処理しているため、ここに来ることはない。
  // ここに来ているということは、 AWS 側で仕様が更新され、カスタムリソースに
  // あたらしいライフサイクルが加わったということを示している。
  // なので、それを補足してエラーレスポンスとして返し、 CloudFormation 側でエラーとしておくことで。
  // デプロイ時にその仕様変更を気付けるようにしておく.
  const requestId = (event as lambda.CloudFormationCustomResourceEvent)
    .RequestId;
  const stackId = (event as lambda.CloudFormationCustomResourceEvent)
    .StackId;
  const requestType: string = (
    event as lambda.CloudFormationCustomResourceEvent
  ).RequestType;
  const logicalResourceId = (
    event as lambda.CloudFormationCustomResourceEvent
  ).LogicalResourceId;
  return {
    RequestId: requestId,
    Status: 'FAILED',
    StackId: stackId,
    Reason: `unknown event: ${requestType}`,
    LogicalResourceId: logicalResourceId,
    PhysicalResourceId: '',
  };
};
