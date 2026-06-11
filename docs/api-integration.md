# Worker Integration

## 概述

`ark-ssh-connector` 仅作为 Cloudflare Workers 内部服务使用，不对公网提供 HTTP API。调用方通过 Service Binding 直接调用 RPC 方法，传入目标主机、登录账号和待执行命令，服务在 Workers 环境中建立 SSH 连接并返回命令输出。

当前支持：

- 健康检查：`health()`
- 执行 SSH 命令：`execute(request)`

## 部署约定

当前 Worker 禁用公开入口：

```toml
workers_dev = false
preview_urls = false
```

调用方 Worker 需要在自己的 `wrangler.toml` 中声明 Service Binding：

```toml
[[services]]
binding = "ARK_SSH_CONNECTOR"
service = "ark-ssh-connector"
```

## 类型定义

调用方可以在项目中声明最小接口，避免依赖本仓库内部实现：

```ts
interface SshCommandRequest {
  ip: string;
  port: number;
  username: string;
  password: string;
  command: string;
}

interface SshCommandResult {
  connected: boolean;
  stdout: string;
  stderr: string;
}

interface ArkSshConnector {
  health(): Promise<{ status: 'healthy' }>;
  execute(request: SshCommandRequest): Promise<SshCommandResult>;
}

interface Env {
  ARK_SSH_CONNECTOR: Service<ArkSshConnector>;
}
```

## 健康检查

### 调用示例

```ts
const health = await env.ARK_SSH_CONNECTOR.health();
```

### 成功返回

```json
{
  "status": "healthy"
}
```

## 执行 SSH 命令

### 调用示例

```ts
const result = await env.ARK_SSH_CONNECTOR.execute({
  ip: '34.172.67.144',
  port: 22,
  username: 'root',
  password: 'password',
  command: 'uname -a',
});
```

### 请求字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ip` | `string` | 是 | SSH 目标主机地址。必须为非空字符串。 |
| `port` | `number` 或可转换为数字的 `string` | 是 | SSH 端口。必须是 `1` 到 `65535` 之间的整数。 |
| `username` | `string` | 是 | SSH 登录用户名。必须为非空字符串。 |
| `password` | `string` | 是 | SSH 登录密码。必须为非空字符串。 |
| `command` | `string` | 是 | 需要在目标主机执行的命令。必须为非空字符串。 |

### 成功返回

```json
{
  "connected": true,
  "stdout": "Linux host 6.8.0-1024-gcp #26-Ubuntu SMP x86_64 GNU/Linux\n",
  "stderr": ""
}
```

### 返回字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `connected` | `boolean` | SSH 连接和命令执行完成时为 `true`。 |
| `stdout` | `string` | 命令标准输出。没有输出时为空字符串。 |
| `stderr` | `string` | 命令标准错误。没有错误输出时为空字符串。 |

注意：命令向 `stderr` 写入内容不一定表示 RPC 调用失败。只要 SSH 连接成功且命令执行流程完成，方法会正常返回。

## 错误处理

字段校验错误、SSH 连接失败、认证失败或命令执行失败都会以异常形式抛出。调用方应使用 `try/catch` 处理：

```ts
try {
  const result = await env.ARK_SSH_CONNECTOR.execute({
    ip,
    port,
    username,
    password,
    command,
  });

  return Response.json(result);
} catch (error) {
  return Response.json(
    {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    },
    { status: 502 },
  );
}
```

### 常见错误

| 场景 | 示例错误 |
| --- | --- |
| 请求值不是对象 | `Request body must be a JSON object` |
| 字符串字段为空或类型不正确 | `ip must be a non-empty string` |
| 端口不合法 | `port must be an integer between 1 and 65535` |
| SSH 认证失败 | `All configured authentication methods failed` |

## 联调注意事项

- `port` 可以传数字，也可以传非空数字字符串，例如 `22` 或 `"22"`。
- 所有字符串字段都会校验非空，但不会自动 trim 后再传给 SSH；调用方应避免在地址、用户名和密码中传入非预期的前后空格。
- SSH ready 超时时间为 `20` 秒。目标主机不可达、端口未开放或网络阻断时，方法会抛出异常。
- 当前接口只执行单条命令，不支持交互式 shell、SFTP、SSH agent 或密钥认证。
- 调用方应自行保护 `password` 等敏感信息，避免写入日志或前端可见位置。
