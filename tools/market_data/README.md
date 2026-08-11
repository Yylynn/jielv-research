# 行情数据接入

网站按以下顺序读取日线行情：

1. `VITE_MARKET_API_URL` 指向的本机研究接口；
2. `public/data/market_daily.json` 中的每日静态数据；
3. 内置演示数据。

账号密码只保存在本机终端或环境变量中，不得写入仓库、网页或导出的 JSON。

> 在把第三方行情数据提交到公开网站前，请确认数据源条款允许公开再分发。未确认前，导出的 JSON 只用于本机研究。

## AKShare：免费指数日线（当前推荐）

无需券商开户或登录。安装 AKShare 后即可读取中国指数的历史日线：

```powershell
python -m pip install akshare
python -m tools.market_data.import_market --provider akshare --symbol sh000300 --name 沪深300 --start 2015-01-01
```

常用代码：沪深300 `sh000300`、上证指数 `sh000001`、深证成指 `sz399001`、创业板指 `sz399006`。也兼容 `000300.SH` 这种 Wind 风格的输入。

## Wind：沪深300日线

先安装并登录 Wind 金融终端，按照终端说明安装 WindPy，然后在项目的 `web` 目录运行：

```powershell
python -m tools.market_data.import_market --provider wind --symbol 000300.SH --name 沪深300 --start 2015-01-01
```

## 富途：指数或股票日线

先下载安装并登录 FutuOpenD，保持默认 API 地址 `127.0.0.1:11111`。然后安装 Python SDK：

```powershell
python -m pip install futu-api
```

富途的证券代码格式是“市场.代码”，例如沪深300为 `SH.000300`，上证指数为 `SH.000001`：

```powershell
python -m tools.market_data.import_market --provider futu --symbol SH.000300 --name 沪深300 --start 2015-01-01
```

本工具只读取不复权的历史日 K，不会请求或解锁交易权限。若 FutuOpenD 使用了自定义地址，可增加 `--host` 和 `--port`。

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
