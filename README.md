# Ailian Miniapp Server

爱联小程序后端 MVP，当前使用 Fastify + TypeScript。

## Commands

```bash
npm install
npm run dev
npm run build
npm run check
npm run db:migrate
```

## Environment

复制 `.env.example` 为 `.env` 后按需调整：

```bash
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
CORS_ORIGIN=*
DATABASE_URL=postgres://ailian:ailian@127.0.0.1:5433/ailian
DB_POOL_MAX=10
WECHAT_APP_ID=你的小程序AppID
WECHAT_APP_SECRET=你的小程序AppSecret
STAFF_SESSION_DAYS=7
STAFF_AUTO_PROVISION=false
UPLOAD_DIR=./uploads
OSS_BUCKET=ailian-merchant-media-test
OSS_REGION=oss-cn-guangzhou
OSS_ROLE_NAME=AilianMerchantMediaEcsRole
OSS_UPLOAD_PREFIX=merchant-media
OSS_SIGNED_URL_SECONDS=600
```

当前暂未自动加载 `.env` 文件，开发时可直接用 shell 环境变量覆盖。

## 地推人员权限

录入页面通过 `wx.login` 验证微信身份。未加入白名单的账号会在页面上看到该小程序范围内的账号标识，管理员可使用它添加地推人员：

```bash
npm run staff:add -- --openid OPENID --name "张三" --role field_agent
```

测试环境如需允许所有微信账号录入，可设置 `STAFF_AUTO_PROVISION=true`。首次登录会自动创建
`field_agent` 账号；正式发布前应恢复为 `false`，重新启用白名单。

商家录入支持 1–5 张商家图片、最多 10 位负责人和选填的资质证明图片。图片通过
生产/测试环境配置 `OSS_BUCKET` 后，小程序先调用
`POST /api/v1/uploads/images/presign` 获取短期直传签名，再直接上传到私有 OSS Bucket。
服务端通过 ECS 实例 RAM 角色获取临时凭证，不保存长期 AccessKey。未配置 OSS 时仍回退到
`POST /api/v1/uploads/images`，并使用 `UPLOAD_DIR` 指定的目录保存文件。

微信公众平台需将 `https://ailian-merchant-media-test.oss-cn-guangzhou.aliyuncs.com`
同时加入 `uploadFile` 和 `downloadFile` 合法域名；开发者工具关闭域名校验时可先行联调。

`field_agent` 可以录入商家；`reviewer` 和 `admin` 为后续审核功能预留。服务端只保存随机会话令牌的 SHA-256 摘要，不保存明文令牌或微信 `session_key`。

## Database

本地开发使用 PostgreSQL + PostGIS：

```bash
docker compose up -d postgres
npm run db:migrate
```

导入 Excel：

```bash
npm run import:excel -- /path/to/ailian_data_import_template.xlsx
```

当前导入规则：

- `商户` sheet 里用 `商户名称 + 手机号` 作为临时唯一键。
- `服务项目` sheet 优先用 `商户名称 + 商户手机号` 关联商户。
- 如果服务项目没有手机号，且同名商户只有一个，会按 `商户名称` 自动关联。
- 正式数据库里的 `merchant_id`、`service_id` 由系统自动生成，不需要人工填写。

## API

### Health

```http
GET /health
```

### API v1

```http
GET /api/v1
POST /api/v1/chat/message
POST /api/v1/auth/wechat
GET  /api/v1/auth/me
POST /api/v1/services/search
GET  /api/v1/services/categories
POST /api/v1/merchants/check-duplicate
POST /api/v1/merchants/
GET /api/v1/merchants/:id
```

新建商家默认进入 `pending` 审核状态，审核通过前不会出现在用户搜索结果中。商家录入坐标统一使用微信地图的 `gcj02` 坐标。

`POST /api/v1/chat/message` body:

```json
{
  "message": "厨房下水堵了，很急",
  "location": {
    "latitude": 35,
    "longitude": 139,
    "communityName": "当前小区"
  }
}
```

`POST /api/v1/services/search` body:

```json
{
  "serviceCategory": "管道疏通",
  "keyword": "厨房",
  "latitude": 31.234567,
  "longitude": 121.512345,
  "radiusKm": 5,
  "limit": 5
}
```

## Current Architecture

```text
src/
  app.ts                  # Fastify app factory
  server.ts               # process entrypoint
  config/env.ts           # environment parsing
  plugins/error-handler.ts
  routes/
    health.routes.ts
    api-v1.routes.ts
    chat.routes.ts
  modules/
    ai/
    chat/
    merchants/
    search/
```

## Test deployment

测试环境使用 `docker-compose.test.yml`，包括 API、PostGIS 和自动申请 HTTPS 证书的 Caddy：

```bash
cp .env.test.example .env.test
# 修改数据库密码和微信 AppSecret
docker compose -f docker-compose.test.yml up -d --build
```

测试地址为 `https://test-api.ailian.help`。`.env.test` 不应提交到版本库。

## Next Backend Steps

1. Add database schema.
2. Import merchant and service data from Excel.
3. Connect the miniapp to `/api/v1/chat/message`.
4. Connect real AI intent extraction.
