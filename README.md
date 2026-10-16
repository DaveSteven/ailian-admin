# Ailian Admin

爱联管理端，使用 React、TypeScript 和 Vite。

## 本地开发

```bash
npm install
npm run dev
```

开发服务器会把 `/api` 代理到 `http://127.0.0.1:3000`。

## 构建

```bash
npm run build
```

产物输出到 `dist/`。独立部署时可通过 `VITE_API_BASE_URL` 指定服务端地址；部署到子路径时通过 `VITE_BASE_PATH` 指定路径，例如 `/admin/`。
