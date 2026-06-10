# ssh2 Worker Compatibility

## 结论

`ssh2@1.17.0` 可以在 Cloudflare Workers 中用于连接 VPS，但不能直接交给 Wrangler 默认打包。

可行方案是：

- 使用 `cloudflare:sockets` 建立 TCP 连接。
- 将 Workers TCP socket 适配为 `ssh2` 的 `cfg.sock`。
- 使用 `patch-package` 应用 `patches/ssh2+1.17.0.patch`，修复 issue `mscdex/ssh2#1494` 覆盖的 poly1305 初始化问题。
- 使用 `scripts/bundle-worker.mjs` 预打包 Worker，并通过 `scripts/shims/` 替换当前场景不需要的 Node-only 模块和 optional native addon。
- 限制功能范围为 password auth + exec，不启用 SSH agent、SFTP、compression、默认 `net.Socket`。
- 强制使用 AES-CTR cipher，避免 `workerd` 中 poly1305 WASM 初始化和 AES-GCM 兼容性问题。

本项目已验证通过：Worker 本地运行时可以通过 `ssh2` 使用 `root + password` 登录临时 VPS，并执行 `printf ark-watcher-ready`。

## 本地验证

验证环境：

- `ssh2@1.17.0`
- `wrangler@4.99.0`
- `typescript@5.9.3`
- `compatibility_flags = ["nodejs_compat"]`

## 相关上游问题

GitHub issue `mscdex/ssh2#1494` 直接覆盖了 Workers / workerd 下的 poly1305 WASM 初始化问题。该 issue 指出 `ssh2/lib/protocol/crypto.js` 会在模块初始化阶段无条件加载 `lib/protocol/crypto/poly1305.js`，而 workerd 不允许这种动态 WASM 初始化。

该 issue 也提到一个独立问题：workerd 的 Node compatibility 对 `aes-*-gcm` 的 `createDecipheriv -> update -> setAuthTag -> final` 路径可能不兼容。当前项目因此只启用：

```ts
['aes128-ctr', 'aes192-ctr', 'aes256-ctr']
```

最小 Worker 验证代码：

```ts
import { Client } from 'ssh2';

export default {
  async fetch(): Promise<Response> {
    const client = new Client();

    client.connect({
      host: '127.0.0.1',
      port: 22,
      username: 'root',
      password: 'password',
    });

    return Response.json({ ok: true });
  },
};
```

执行：

```bash
npx wrangler deploy --dry-run --outdir "/tmp/arkwatcher-ssh2-check/dist"
```

直接使用 Wrangler 默认打包的结果：

```text
Build failed with 2 errors:
No loader is configured for ".node" files: node_modules/cpu-features/build/Release/cpufeatures.node
No loader is configured for ".node" files: node_modules/ssh2/lib/protocol/crypto/build/Release/sshcrypto.node
```

额外证据：

```bash
find "node_modules/ssh2" -path "*.node" -print
```

输出包含：

```text
node_modules/ssh2/lib/protocol/crypto/build/Release/sshcrypto.node
node_modules/ssh2/lib/protocol/crypto/build/Release/obj.target/sshcrypto.node
```

## 当前限制

当前 bundle 明确不支持：

- SSH agent authentication
- SFTP
- SSH compression
- `ssh2` 默认 `net.Socket` 连接路径

这些路径被 `scripts/shims/` 拦截，避免 Workers 加载 `fs`、`child_process`、native `.node` addon 等不可用能力。

## 运行配置

需要在 Cloudflare Worker secrets / variables 中配置：

```text
VPS_SSH_HOST
VPS_SSH_PORT
VPS_SSH_USERNAME
VPS_SSH_PASSWORD
VPS_SSH_COMMAND
```

`VPS_SSH_PORT` 为空时默认使用 `22`，`VPS_SSH_USERNAME` 为空时默认使用 `root`，`VPS_SSH_COMMAND` 为空时默认执行 `printf ark-watcher-ready`。
