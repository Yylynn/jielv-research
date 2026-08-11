# 行情数据接入

网站按以下顺序读取日线行情：

1. `VITE_MARKET_API_URL` 指向的本机研究接口；
2. `public/data/market_daily.json` 中的每日静态数据；
3. 内置演示数据。

账号密码只保存在本机终端或环境变量中，不得写入仓库、网页或导出的 JSON。

> 在把 Wind、天勤或文华数据提交到公开网站前，请确认对应账号的数据授权允许公开再分发。未确认前，导出的 JSON 只用于本机研究。

## Wind：沪深300日线

先安装并登录 Wind 金融终端，按照终端说明安装 WindPy，然后在项目的 `web` 目录运行：

```powershell
python -m tools.market_data.import_market --provider wind --symbol 000300.SH --name 沪深300 --start 2015-01-01
```

## 天勤：期货或股指期货

示例以沪深300股指期货主连为标的。运行后工具会在本机交互式询问账号和密码，密码不会显示，也不会写入输出文件：

```powershell
python -m tools.market_data.import_market --provider tqsdk --symbol KQ.m@CFFEX.IF --name 沪深300股指主连 --start 2015-01-01
```

不要把账号写入命令历史、配置文件或提交到 GitHub。后续自动更新时应改用系统凭据管理器。

## Wind / 文华导出 CSV

也可以从终端导出包含日期、开、高、低、收、成交量的 CSV：

```powershell
python -m tools.market_data.import_market --provider csv --input D:\data\000300.csv --symbol 000300.SH --name 沪深300 --volume-divisor 100000000 --volume-unit 亿
```

## 本机研究接口

导入完成后启动：

```powershell
python -m tools.market_data.serve_local
```

本地前端设置 `VITE_MARKET_API_URL=http://127.0.0.1:8765` 后，会优先使用该接口。公开的 GitHub Pages 会读取已提交的静态 JSON。
