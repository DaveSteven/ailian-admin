export type MerchantImportRow = {
  商户名称?: string;
  联系人?: string;
  手机号?: string | number;
  微信号?: string;
  服务大类?: string;
  服务标签?: string;
  省市区?: string;
  详细地址?: string;
  经度?: string | number;
  纬度?: string | number;
  服务半径km?: string | number;
  营业时间?: string;
  是否夜间服务?: string;
  是否认证?: string;
  评分?: string | number;
  备注?: string;
};

export type ServiceImportRow = {
  商户名称?: string;
  商户手机号?: string | number;
  手机号?: string | number;
  服务大类?: string;
  服务小类?: string;
  用户常见说法?: string;
  价格类型?: string;
  最低价?: string | number;
  最高价?: string | number;
  价格说明?: string;
  是否可紧急上门?: string;
  平均响应时间?: string;
  服务说明?: string;
};
