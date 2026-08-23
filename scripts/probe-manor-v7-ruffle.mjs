import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(process.argv[2] ?? process.env.MANOR_V7_SOURCE_PATH ?? "D:\\QQnc");
const pluginRoot = await findPluginRoot(sourceRoot);
const coreRoot = join(pluginRoot, "core");
const bundledPublicRoot = resolve(repositoryRoot, "apps", "web", "public");
const ruffleRoot = resolve(repositoryRoot, "apps", "web", "node_modules", "@ruffle-rs", "ruffle");
const outputRoot = resolve(repositoryRoot, "data", "manor-v7-ruffle-probe");
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const probeVariant = process.argv[3] ?? process.env.MANOR_V7_PROBE_VARIANT ?? "baseline";
const probeScene = (process.argv[4] ?? process.env.MANOR_V7_PROBE_SCENE) === "pasture" ? "pasture" : "farm";
const useBundledResources = probeVariant === "bundled";
const requestLog = [];
const consoleLog = [];
const runtimeErrors = [];

await assertFile(join(coreRoot, "module", probeScene === "farm" ? "happyfarm3_v_101.swf" : "mcloader_v_28.swf"));
await assertFile(join(ruffleRoot, "ruffle.js"));
await mkdir(outputRoot, { recursive: true });

const server = createHttpServer(async (request, response) => {
  const startedAt = Date.now();
  let statusCode = 500;
  let source = "probe";
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      statusCode = 200;
      response.writeHead(statusCode, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(probeHtml());
      return;
    }
    if (url.pathname === "/favicon.ico") {
      statusCode = 204;
      response.writeHead(statusCode);
      response.end();
      return;
    }
    if (url.pathname === "/crossdomain.xml") {
      statusCode = 200;
      response.writeHead(statusCode, { "content-type": "application/xml; charset=utf-8" });
      response.end('<?xml version="1.0"?><cross-domain-policy><allow-access-from domain="*" /></cross-domain-policy>');
      return;
    }
    if (useBundledResources && url.pathname.startsWith("/assets/manor/v7-swf/config/")) {
      const filePath = safeResolve(bundledPublicRoot, decodeURIComponent(url.pathname.slice(1)));
      const origin = requestOrigin(request);
      const xml = (await readFile(filePath, "utf8")).replaceAll("__MANOR_ORIGIN__", origin);
      source = "bundled:absolute-config";
      statusCode = 200;
      return sendXml(response, xml);
    }
    if (url.pathname.includes("/xml/load_main_v_") || url.pathname === "/xml.php" && url.searchParams.get("mod")?.startsWith("load_main")) {
      source = "generated:nc_main.php";
      statusCode = 200;
      return sendXml(response, await sourceXml("nc_main.php", requestOrigin(request)));
    }
    if (url.pathname.includes("/xml/data_zh_CN_v_") || url.pathname === "/xml.php" && url.searchParams.get("mod")?.startsWith("data_zh")) {
      source = "generated:nc_data.php";
      statusCode = 200;
      return sendXml(response, await sourceXml("nc_data.php", requestOrigin(request)));
    }
    if (url.pathname.includes("/xml/addon_v_") || url.pathname === "/xml.php" && url.searchParams.get("mod")?.startsWith("addon_v")) {
      source = "generated:nc_addon.php";
      statusCode = 200;
      return sendXml(response, await sourceXml("nc_addon.php", requestOrigin(request)));
    }
    if (url.pathname === "/mync.php" || url.pathname === "/api/manor/flash/farm") {
      const farmResponse = mockFarmResponse(url);
      source = farmResponse.source;
      statusCode = 200;
      const body = JSON.stringify(farmResponse.body);
      response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store"
      });
      response.end(body);
      return;
    }
    if (url.pathname === "/mymc.php" || url.pathname === "/api/manor/flash/pasture") {
      const pastureResponse = mockPastureResponse(url);
      source = pastureResponse.source;
      statusCode = 200;
      const body = JSON.stringify(pastureResponse.body);
      response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store"
      });
      response.end(body);
      return;
    }
    if (url.pathname.startsWith("/ruffle/")) {
      source = "ruffle";
      statusCode = await sendFile(response, safeResolve(ruffleRoot, url.pathname.slice("/ruffle/".length)));
      return;
    }
    if (url.pathname.startsWith("/assets/manor/v7-swf/")) {
      source = "bundled:v7-swf";
      statusCode = await sendFile(response, safeResolve(bundledPublicRoot, decodeURIComponent(url.pathname.slice(1))));
      return;
    }
    source = "qqfarm-core";
    statusCode = await sendFile(response, safeResolve(coreRoot, decodeURIComponent(url.pathname.slice(1))));
  } catch (error) {
    statusCode = error?.code === "ENOENT" ? 404 : 500;
    response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
    response.end(statusCode === 404 ? "Not found" : String(error));
  } finally {
    requestLog.push({
      method: request.method,
      url: request.url,
      statusCode,
      source,
      durationMs: Date.now() - startedAt
    });
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", resolveListen);
});

const serverAddress = server.address();
const serverPort = typeof serverAddress === "object" && serverAddress ? serverAddress.port : 0;
if (!serverPort) throw new Error("Ruffle probe server did not receive a port");
const baseUrl = `http://127.0.0.1:${serverPort}`;
const debuggingPort = await availablePort();
const chromeProfile = resolve(outputRoot, "chrome-profile", String(process.pid));
await mkdir(chromeProfile, { recursive: true });

const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${debuggingPort}`,
  "--remote-debugging-address=127.0.0.1",
  "--remote-allow-origins=*",
  `--user-data-dir=${chromeProfile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-dev-shm-usage",
  "--force-device-scale-factor=1",
  "about:blank"
], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });

let chromeError = "";
chrome.stderr.setEncoding("utf8");
chrome.stderr.on("data", (chunk) => { chromeError += chunk; });

try {
  const target = await waitForPageTarget(debuggingPort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl, (message) => {
    if (message.method === "Runtime.consoleAPICalled") {
      consoleLog.push({
        type: message.params.type,
        timestamp: message.params.timestamp,
        values: message.params.args.map((argument) => argument.value ?? argument.description ?? argument.type)
      });
    }
    if (message.method === "Runtime.exceptionThrown") {
      runtimeErrors.push(message.params.exceptionDetails);
    }
  });
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 820,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 820
    });
    await cdp.send("Page.navigate", { url: baseUrl });
    await waitForExpression(cdp, "document.readyState === 'complete'", 15_000);
    await waitForExpression(cdp, "window.__ruffleProbe?.phase === 'loaded' || window.__ruffleProbe?.phase === 'failed'", 20_000);
    await delay(15_000);

    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    });
    const screenshotPath = resolve(outputRoot, `${probeScene}.png`);
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    const page = await evaluate(cdp, `(() => {
      const player = document.querySelector('ruffle-player');
      const canvas = player?.shadowRoot?.querySelector('canvas') ?? document.querySelector('canvas');
      const rect = player?.getBoundingClientRect();
      let pixelSample = null;
      try {
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let opaque = 0;
            let colorful = 0;
            const stride = Math.max(4, Math.floor(data.length / 40000 / 4) * 4);
            for (let index = 0; index < data.length; index += stride) {
              if (data[index + 3] > 0) opaque += 1;
              if (Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) > 12) colorful += 1;
            }
            pixelSample = { opaque, colorful, stride };
          }
        }
      } catch (error) {
        pixelSample = { error: String(error) };
      }
      return {
        probe: window.__ruffleProbe,
        player: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
        shadowChildren: player?.shadowRoot?.childElementCount ?? null,
        canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
        pixelSample,
        bodyText: document.body.innerText
      };
    })()`);

    const report = {
      generatedAt: new Date().toISOString(),
      sourceRoot,
      pluginRoot,
      ruffleVersion: JSON.parse(await readFile(join(ruffleRoot, "package.json"), "utf8")).version,
      probeVariant,
      probeScene,
      baseUrl,
      screenshotPath,
      page,
      requests: requestLog,
      failedRequests: requestLog.filter((item) => item.statusCode >= 400),
      console: consoleLog,
      runtimeErrors,
      chromeStderr: chromeError.trim()
    };
    const reportPath = resolve(outputRoot, `report-${probeScene}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ reportPath, screenshotPath, page, failedRequests: report.failedRequests, runtimeErrors: runtimeErrors.length }, null, 2)}\n`);
  } finally {
    cdp.close();
  }
} catch (error) {
  const failureReport = {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    pluginRoot,
    baseUrl,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    chrome: {
      exitCode: chrome.exitCode,
      signalCode: chrome.signalCode,
      stderr: chromeError.trim()
    },
    requests: requestLog,
    console: consoleLog,
    runtimeErrors
  };
  const failurePath = resolve(outputRoot, "failure-report.json");
  await writeFile(failurePath, `${JSON.stringify(failureReport, null, 2)}\n`, "utf8");
  throw new Error(`Ruffle probe failed; see ${failurePath}\n${error instanceof Error ? error.stack : String(error)}\nChrome: ${chromeError.trim()}`);
} finally {
  if (chrome.pid && chrome.exitCode === null) {
    spawnSync("taskkill.exe", ["/pid", String(chrome.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
  }
  server.closeAllConnections();
  await new Promise((resolveClose) => server.close(() => resolveClose()));
}

function probeHtml() {
  const assetRoot = useBundledResources ? "/assets/manor/v7-swf" : "";
  const moduleRoot = "/module";
  const farmParameters = {
    hmv2level: "0",
    hmv2CloseTime: "1261929600",
    config_url: useBundledResources ? `${assetRoot}/config/load_main_v_20120209.xml` : "/xml/load_main_v_20120209.xml",
    config_data: useBundledResources ? `${assetRoot}/config/data_zh_CN_v_20120209.xml` : "/xml/data_zh_CN_v_20120209.xml",
    config_addon: useBundledResources ? `${assetRoot}/config/addon_v_20120209.xml` : "/xml/addon_v_20120209.xml",
    loadingUrl: `${moduleRoot}/loading2_v_3.swf`,
    mode: "1",
    pageDomain: "127.0.0.1",
    useflag: "11111111",
    usercheck: "probe",
    app_status_bitmap: "000000000000000f",
    app_request_num: "0"
  };
  const pastureParameters = {
    config_url_qz: useBundledResources ? `${assetRoot}/config/mcini_main_v_20120209.xml` : "/xml/mcini_main_v_20120209.xml",
    config_url_xy: useBundledResources ? `${assetRoot}/config/mcini_main_v_20120209.xml` : "/xml/mcini_main_v_20120209.xml",
    cardConfig_url_qz: useBundledResources ? `${assetRoot}/config/mccard_zh_CN_v_20120209.xml` : "/xml/mccard_zh_CN_v_20120209.xml",
    cardConfig_url_xy: useBundledResources ? `${assetRoot}/config/mccard_zh_CN_v_20120209.xml` : "/xml/mccard_zh_CN_v_20120209.xml",
    animalConfig_url_qz: useBundledResources ? `${assetRoot}/config/mcdata_zh_CN_v_20120209.xml` : "/xml/mcdata_zh_CN_v_20120209.xml",
    animalConfig_url_xy: useBundledResources ? `${assetRoot}/config/mcdata_zh_CN_v_20120209.xml` : "/xml/mcdata_zh_CN_v_20120209.xml",
    loadingUrl: `${moduleRoot}/loading2_v_3.swf`,
    mode: "1",
    pageDomain: "127.0.0.1",
    pasture_friend_list_mod_qz: "1000",
    pasture_friend_list_mod_xy: "1000",
    pasture_friend_list_qz: "1001-1002",
    pasture_friend_list_xy: "1001-1002",
    pasture_enter: "1000",
    pasture_enter_mod: "1000",
    pasture_steal: "1000",
    pasture_steal_mod: "1000",
    useflag: "11111111",
    usercheck: "probe",
    app_status_bitmap: "000000000000000f",
    app_request_num: "0"
  };
  const parameters = probeScene === "farm" ? farmParameters : pastureParameters;
  const swfUrl = probeScene === "farm" ? `${moduleRoot}/happyfarm3_v_101.swf` : `${moduleRoot}/mcloader_v_28.swf`;
  const sceneTitle = probeScene === "farm" ? "农场" : "牧场";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>QQ ${sceneTitle} V7 Ruffle probe</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #20242a; color: #fff; font: 14px Arial, sans-serif; }
    main { width: min(1100px, 100vw); margin: 0 auto; }
    #status { height: 28px; display: flex; align-items: center; padding: 0 12px; background: #101318; }
    #player { width: 100%; min-height: 640px; background: #fff; }
    ruffle-player { display: block; width: 100%; height: 640px; }
  </style>
  <script>
    window.__ruffleProbe = { phase: 'booting' };
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = {
      autoplay: 'on',
      unmuteOverlay: 'hidden',
      logLevel: 'debug',
      allowScriptAccess: true,
      splashScreen: false,
      letterbox: 'on',
      warnOnUnsupportedContent: true
    };
  </script>
  <script src="/ruffle/ruffle.js"></script>
</head>
<body>
  <main>
    <div id="status">正在启动原版${sceneTitle} SWF...</div>
    <div id="player"></div>
  </main>
  <script>
    (async () => {
      try {
        const ruffle = window.RufflePlayer.newest();
        const player = ruffle.createPlayer();
        player.id = 'swfAppObject';
        document.querySelector('#player').appendChild(player);
        window.__ruffleProbe = { phase: 'loading' };
        await player.ruffle().load({
          url: '${swfUrl}',
          parameters: ${JSON.stringify(parameters)},
          autoplay: 'on',
          allowScriptAccess: true,
          backgroundColor: '#ffffff',
          scale: 'showAll'
        });
        window.__ruffleProbe = { phase: 'loaded' };
        document.querySelector('#status').textContent = 'Ruffle 已接管 SWF，等待${sceneTitle}资源与接口完成';
      } catch (error) {
        window.__ruffleProbe = { phase: 'failed', error: String(error), stack: error?.stack };
        document.querySelector('#status').textContent = 'Ruffle 启动失败：' + error;
        console.error(error);
      }
    })();
  </script>
</body>
</html>`;
}

function mockFarmBootstrap() {
  const now = Math.floor(Date.now() / 1000);
  const useFormalUser = probeVariant === "formal-user" || probeVariant === "formal-all";
  const useFormalLands = probeVariant === "formal-lands" || probeVariant === "formal-all";
  const emptyLand = (index) => ({
    a: 0, b: 0, c: 0, d: 0, e: 1, f: 0, g: 0, h: 1, i: 100, j: 0,
    k: 0, l: 0, m: 0, n: [], o: 0, p: [], q: 0, r: useFormalLands ? now : 1251351725 + index,
    bitmap: 0, pId: 0
  });
  const farmlandStatus = Array.from({ length: 18 }, (_, index) => emptyLand(index));
  if (useFormalLands) {
    farmlandStatus[0] = { ...emptyLand(0), a: 6, b: 4, q: now - 37_553 };
    farmlandStatus[1] = { ...emptyLand(1), a: 1, b: 2, f: 1, q: now - 15_466 };
    farmlandStatus[2] = { ...emptyLand(2), a: 1, b: 2, q: now - 15_923 };
    farmlandStatus[3] = { ...emptyLand(3), a: 1, b: 2, g: 1, q: now - 26_266 };
    for (let index = 6; index < farmlandStatus.length; index += 1) farmlandStatus[index].h = 0;
  } else {
    farmlandStatus[0] = { ...emptyLand(0), a: 2, b: 6, k: 16, l: 9, m: 16, q: now - 36030 };
    farmlandStatus[1] = { ...emptyLand(1), a: 2, b: 3, f: 1, q: now - 14400 };
    farmlandStatus[2] = { ...emptyLand(2), a: 3, b: 4, g: 1, q: now - 25200 };
  }
  return {
    a: 0,
    b: 1,
    c: 0,
    d: 0,
    dog: { dogId: 0, isHungry: 0 },
    e: 0,
    exp: 12000,
    farmlandStatus,
    items: {
      1: { itemId: 1 },
      2: { itemId: 2 },
      3: { itemId: 3 },
      4: { itemId: 4 }
    },
    serverTime: { time: now },
    user: {
      canbad: 25,
      exp: 12000,
      headPic: "",
      healthMode: {
        beginTime: 0,
        canClose: 1,
        date: "1970-01-01|1970-01-07",
        endTime: 0,
        serverTime: now,
        set: 0,
        time: "08|00",
        valid: 0
      },
      missionTime: now,
      money: 100000,
      FB: useFormalUser ? 0 : 100,
      moralexp: 0,
      pf: 0,
      uId: useFormalUser ? 1007093261 : 1,
      uinLogin: useFormalUser ? 1007093261 : 1,
      userName: useFormalUser ? "庄园验收" : "V7 探针玩家",
      yellowlevel: 0,
      yellowstatus: 0
    },
    weather: { weatherDesc: "晴天", weatherId: 1 },
    beast: { drop: [], info: [], return: [] }
  };
}

function mockFarmResponse(url) {
  const moduleName = (url.searchParams.get("qzonemod") ?? "").toLowerCase();
  const actionName = (url.searchParams.get("act") ?? "").toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  if (moduleName === "user" && actionName === "run") {
    return { source: "mock:farm-bootstrap", body: mockFarmBootstrap() };
  }
  if (moduleName === "cgi_farm_request_count") {
    return { source: "mock:farm-request-count", body: { alread: 0, show: 0, unread: 0 } };
  }
  if (moduleName === "user" && actionName === "getnotice") {
    return {
      source: "mock:farm-notice",
      body: {
        id: now,
        content: "",
        time: now,
        have_new_feeds: false,
        have_new_msg: false,
        have_new_sysmsg: false,
        code: 1
      }
    };
  }
  if (moduleName === "cgi_fish_index") {
    return { source: "mock:fish-index", body: { code: 1, fish: [], open: 0 } };
  }
  if (moduleName === "cgi_farm_login_home") {
    return {
      source: "mock:farm-login-home",
      body: { bonus: 0, code: 1, days: 1, ecode: 0, is_playing: 0, number: 0, timestamp: now }
    };
  }
  return { source: `mock:unsupported:${moduleName || "unknown"}`, body: { code: 0, direction: "unsupported" } };
}

function mockPastureResponse(url) {
  const moduleName = (url.searchParams.get("mod") ?? "").toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  if (moduleName === "cgi_enter") {
    return {
      source: "mock:pasture-bootstrap",
      body: {
        animal: [
          { buyTime: now - 165_601, cId: 1002, growTime: 165_601, growTimeNext: 14_399, hungry: 0, serial: 1, status: 3, statusNext: 6, totalCome: 0 },
          { buyTime: now - 36_001, cId: 1002, growTime: 36_001, growTimeNext: 7_199, hungry: 0, serial: 2, status: 2, statusNext: 3, totalCome: 0 }
        ],
        stealflag: { 1002: 3 },
        enemy: { type: 1, num: 0 },
        items: {
          1: { id: 105, lv: 1, skin: 0, msg: 0 },
          2: { id: 102, lv: 1 },
          3: { id: 103, lv: 1 }
        },
        a: 0,
        c: 0,
        d: 0,
        notice: "",
        animalFood: 20,
        badinfo: [{ mynum: 0, num: 0, type: 1 }, { mynum: 0, num: 0, type: 2 }],
        parade: [],
        serverTime: { time: now },
        task: { taskFlag: 1, taskId: 0 },
        user: {
          exp: 1200,
          headPic: "",
          money: 100000,
          moralexp: 0,
          flv: 12,
          FBPrice: 0,
          uId: 1,
          uin: 1,
          userName: "V7 探针玩家",
          yellowlevel: 0,
          yellowstatus: 0
        },
        weather: { weatherDesc: "晴天", weatherId: 1 },
        research: { den: { endtime: 0, animalid: 0 }, shed: { endtime: 0, animalid: 0 } },
        beast: { drop: [], info: [], return: [] }
      }
    };
  }
  if (moduleName === "friend") {
    return {
      source: "mock:pasture-friends",
      body: [{ uId: 1, uin: 1, userName: "V7 探针玩家", headPic: "", yellowlevel: 0, yellowstatus: 0, exp: 1200, money: 100000, pf: 0 }]
    };
  }
  if (moduleName === "cgi_get_notice" || moduleName === "cgi_farm_get_common_notice") {
    return { source: "mock:pasture-notice", body: { code: 1, content: "", time: now } };
  }
  if (moduleName === "cgi_pasture_login_home" || moduleName === "cgi_pasture_checkbitmap" || moduleName === "cgi_farm_checkbitmap") {
    return { source: `mock:${moduleName}`, body: { code: 1, ecode: 0, bitmap: 0, timestamp: now } };
  }
  return { source: `mock:unsupported:${moduleName || "unknown"}`, body: { code: 0, direction: "unsupported" } };
}

async function sourceXml(fileName, origin) {
  const filePath = join(coreRoot, "source", "xml", "mod", fileName);
  const source = await readFile(filePath, "utf8");
  const match = source.match(/<<<XML\s*([\s\S]*?)\s*XML;/);
  if (!match) throw new Error(`Could not extract XML heredoc from ${filePath}`);
  return match[1].replaceAll("$url", origin);
}

function sendXml(response, body) {
  response.writeHead(200, {
    "content-type": "application/xml; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  response.end(body);
}

async function sendFile(response, filePath) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw Object.assign(new Error("Not found"), { code: "ENOENT" });
  response.writeHead(200, {
    "content-type": mimeType(filePath),
    "content-length": fileStat.size,
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  await new Promise((resolveStream, rejectStream) => {
    const stream = createReadStream(filePath);
    stream.once("error", rejectStream);
    response.once("finish", resolveStream);
    stream.pipe(response);
  });
  return 200;
}

function safeResolve(root, relativePath) {
  const cleaned = normalize(relativePath).replace(/^([/\\])+/, "");
  const target = resolve(root, cleaned);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(prefix)) throw new Error("Path escaped source root");
  return target;
}

function requestOrigin(request) {
  return `http://${request.headers.host}`;
}

function mimeType(filePath) {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".swf": "application/x-shockwave-flash",
    ".wasm": "application/wasm",
    ".xml": "application/xml; charset=utf-8"
  };
  return types[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function findPluginRoot(root) {
  const candidates = [
    join(root, "wwwroot", "source", "plugin", "qqfarm"),
    join(root, "source", "plugin", "qqfarm"),
    root
  ];
  for (const candidate of candidates) {
    try {
      const candidateStat = await stat(join(candidate, "core", "module", "happyfarm3_v_101.swf"));
      if (candidateStat.isFile()) return candidate;
    } catch {
      // Try the next known source layout.
    }
  }
  throw new Error(`QQ Farm V7 plugin root was not found below ${root}`);
}

async function assertFile(filePath) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw new Error(`Required file is missing: ${filePath}`);
}

async function waitForExpression(cdp, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

async function waitForPageTarget(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((candidate) => candidate.type === "page");
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Chrome has not opened the debugging endpoint yet.
    }
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not become ready");
}

async function connectCdp(url, onEvent) {
  const socket = new WebSocket(url);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) {
      onEvent(message);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result ?? {});
  });
  socket.addEventListener("close", () => {
    for (const request of pending.values()) request.reject(new Error("Chrome DevTools connection closed"));
    pending.clear();
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolveRequest, rejectRequest) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectRequest(new Error(`Chrome DevTools command timed out: ${method}`));
        }, 20_000);
        pending.set(id, {
          resolve(value) { clearTimeout(timeout); resolveRequest(value); },
          reject(error) { clearTimeout(timeout); rejectRequest(error); }
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); }
  };
}

async function availablePort() {
  const server = createNetServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  if (!port) throw new Error("Could not allocate a Chrome debugging port");
  return port;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
