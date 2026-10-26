const messages:Record<string,string>={
  API_TIMEOUT:'模型请求超时，请检查网络后重试',EMPTY_RESPONSE:'模型没有返回正文，请重试',
  API_KEY_MISSING:'请输入 API Key，并保存设置',API_AUTH_FAILED:'Key 无效或没有模型权限，请检查后重试',API_RATE_LIMIT:'服务请求过于频繁或额度受限，请稍后重试',
  API_MODEL_MISSING:'请输入模型名称',API_ENDPOINT_INVALID:'API 地址无效，请使用不含凭据的 HTTPS 地址',API_MODEL_OR_ENDPOINT:'模型或 API 地址不可用，请核对设置',
  API_NETWORK_ERROR:'无法连接模型服务，请检查网络后重试',API_SERVICE_ERROR:'模型服务暂时不可用，请稍后重试',API_STREAM_INTERRUPTED:'回答中途断开，已收到内容保留，可重试',
  API_RESPONSE_INVALID:'模型服务返回格式不受支持，请检查接口地址',API_OUTPUT_LIMIT:'回答达到服务长度上限，已收到内容保留',API_CONTENT_FILTER:'服务未能完成此回答，已收到内容保留',
  KEY_ENCRYPTION_UNAVAILABLE:'Windows 密钥加密不可用，未保存 Key',KEY_READ_FAILED:'无法读取已保存的 Key，请重新输入',API_NEW_ENDPOINT_KEY:'API 地址已更改，请为新地址输入 Key',
};
export const apiErrorMessage=(code?:string)=>messages[code||''];
