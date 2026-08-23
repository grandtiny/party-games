import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.argv[2] ?? process.env.BASE_URL ?? "http://127.0.0.1:18081").replace(/\/$/, "");
const outputDirectory = resolve(projectRoot, "data", "manor-v7-visual-qa");
const chromeProfile = resolve(outputDirectory, "chrome-profile", String(process.pid));
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const credentials = {
  username: "manorqa",
  displayName: "庄园验收",
  password: "ManorQA123!"
};
const ruffleDebug = process.env.RUFFLE_DEBUG === "1";
const feedQa = process.env.MANOR_V7_FEED_QA === "1";
const decorationQa = process.env.MANOR_V7_DECORATION_QA === "1";
const wildQa = process.env.MANOR_V7_WILD_QA === "1";
const shopDetailQa = process.env.MANOR_V7_SHOP_DETAIL_QA === "1";
const regressionQa = process.env.MANOR_V7_REGRESSION_QA === "1" || process.argv.includes("--regression");
const responses = [];
const failedLoads = [];
const consoleErrors = [];
const consoleMessages = [];
const runtimeExceptions = [];
let feedQaReport = null;
let regressionQaReport = null;

await mkdir(chromeProfile, { recursive: true });
const debuggingPort = await availablePort();
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${debuggingPort}`,
    "--remote-debugging-address=127.0.0.1",
    "--remote-allow-origins=*",
    `--user-data-dir=${chromeProfile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--force-device-scale-factor=1",
    "about:blank"
  ],
  { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
);

let chromeError = "";
chrome.stderr.setEncoding("utf8");
chrome.stderr.on("data", (chunk) => { chromeError += chunk; });

try {
  const target = await waitForPageTarget(debuggingPort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl, (message) => {
    if (message.method === "Network.responseReceived") {
      const response = message.params.response;
      responses.push({ url: response.url, status: response.status, mimeType: response.mimeType });
    }
    if (message.method === "Network.loadingFailed") {
      failedLoads.push({ url: message.params.blockedReason ?? "unknown", errorText: message.params.errorText });
    }
    if (message.method === "Runtime.consoleAPICalled") {
      const args = message.params.args.map((argument) => argument.value ?? argument.description ?? argument.type);
      consoleMessages.push({ type: message.params.type, args });
      if (message.params.type === "error") consoleErrors.push(args);
    }
    if (message.method === "Runtime.exceptionThrown") {
      runtimeExceptions.push(message.params.exceptionDetails);
    }
  });
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    await setViewport(cdp, { width: 1440, height: 900, mobile: false });
    await navigate(cdp, `${baseUrl}/`);
    await authenticate(cdp);
    if (feedQa) await prepareFeedQa(cdp);

    const reports = [];
    const interactionReports = [];
    const viewports = [
      { name: "desktop", width: 1440, height: 900, mobile: false },
      { name: "narrow", width: 390, height: 844, mobile: true }
    ];
    for (const viewport of wildQa ? viewports.slice(0, 1) : viewports) {
      await setViewport(cdp, viewport);
      await navigate(cdp, `${baseUrl}/manor`);
      await waitForManor(cdp);
      await delay(15_000);
      reports.push(await captureScene(cdp, viewport.name, "farm"));
      if (viewport.name === "desktop" && !wildQa) {
        if (regressionQa) {
          regressionQaReport = await verifySceneNavigationRegression(cdp);
        }
        await moveStage(cdp, 550, 612);
        await delay(800);
        interactionReports.push(await captureScene(cdp, "desktop-toolbar-tip", "farm"));
        await clickStage(cdp, 1044, 39);
        await delay(2_500);
        interactionReports.push(await captureScene(cdp, "desktop-decoration", "farm"));
        if (decorationQa) {
          await clickStage(cdp, 443, 154);
          await delay(2_500);
          interactionReports.push(await captureScene(cdp, "desktop-board-list", "farm"));
          await clickStage(cdp, 434, 248);
          await delay(2_500);
          const selectedBoard = await manorDecorationSnapshot(cdp);
          interactionReports.push(await captureScene(cdp, "desktop-board-selected", "farm"));
          if (selectedBoard.selectedBoardId !== 90475) {
            throw new Error(`告示牌选择回归失败：${JSON.stringify(selectedBoard)}`);
          }
          await clickStage(cdp, 434, 248);
          await delay(2_500);
          const clearedBoard = await manorDecorationSnapshot(cdp);
          if (clearedBoard.selectedBoardId !== null) {
            throw new Error(`告示牌取消回归失败：${JSON.stringify(clearedBoard)}`);
          }
          await clickStage(cdp, 512, 154);
          await delay(4_000);
          interactionReports.push(await captureScene(cdp, "desktop-avatar-list", "farm"));
          await clickStage(cdp, 414, 300);
          await delay(3_000);
          interactionReports.push(await captureScene(cdp, "desktop-avatar-preview", "farm"));
          await clickStage(cdp, 547, 441);
          await delay(3_000);
          const selectedAvatar = await manorDecorationSnapshot(cdp);
          interactionReports.push(await captureScene(cdp, "desktop-avatar-selected", "farm"));
          if (selectedAvatar.selectedAvatarId === null) {
            throw new Error(`农场形象选择回归失败：${JSON.stringify(selectedAvatar)}`);
          }
          await navigate(cdp, `${baseUrl}/manor`);
          await waitForManor(cdp);
          await delay(5_000);
          const persistedAvatar = await manorDecorationSnapshot(cdp);
          if (persistedAvatar.selectedAvatarId !== selectedAvatar.selectedAvatarId) {
            throw new Error(`农场形象刷新持久化失败：${JSON.stringify({ selectedAvatar, persistedAvatar })}`);
          }
          await clearAvatarQa(cdp);
        } else {
          await clickStage(cdp, 738, 122);
        }
        await delay(500);
        await clickStage(cdp, 974, 39);
        await delay(2_500);
        interactionReports.push(await captureScene(cdp, "desktop-shop", "farm"));
        await navigate(cdp, `${baseUrl}/manor`);
        await waitForManor(cdp);
        await delay(5_000);
        await clickStage(cdp, 784, 39);
        await delay(2_500);
        interactionReports.push(await captureScene(cdp, "desktop-warehouse", "farm"));
        await navigate(cdp, `${baseUrl}/manor`);
        await waitForManor(cdp);
        await delay(5_000);
        await clickStage(cdp, 1088, 280);
        await delay(2_500);
        interactionReports.push(await captureScene(cdp, "desktop-friends", "farm"));
      }
      if (ruffleDebug) {
        await evaluate(cdp, `(() => {
          if (!window.RufflePlayer?.config) throw new Error('Ruffle config is unavailable');
          window.RufflePlayer.config.logLevel = 'debug';
        })()`);
      }
      await selectScene(cdp, "pasture");
      await delay(15_000);
      reports.push(await captureScene(cdp, viewport.name, "pasture"));
      if (viewport.name === "desktop") {
        if (feedQa) {
          const beforeFeed = await manorSnapshot(cdp);
          await clickStage(cdp, 255, 350);
          await delay(2_500);
          interactionReports.push(await captureScene(cdp, "desktop-feed-select", "pasture"));
          await clickStage(cdp, 508, 384);
          await delay(2_500);
          interactionReports.push(await captureScene(cdp, "desktop-feed-shop", "pasture"));
          await clickStageDirect(cdp, 360, 220);
          await delay(2_500);
          interactionReports.push(await captureScene(cdp, "desktop-feed-purchase", "pasture"));
          await clickStageDirect(cdp, 507, 455);
          await delay(5_000);
          interactionReports.push(await captureScene(cdp, "desktop-feed-result", "pasture"));
          const afterFeed = await manorSnapshot(cdp);
          const feedRequests = responses.filter((response) =>
            response.url.includes("/api/manor/flash/pasture?mod=cgi_feed_food")
          );
          feedQaReport = {
            before: beforeFeed,
            after: afterFeed,
            coinDelta: afterFeed.coins - beforeFeed.coins,
            grassDelta: afterFeed.grass - beforeFeed.grass,
            requestCount: feedRequests.length,
            responses: feedRequests
          };
          if (
            feedQaReport.requestCount !== 1 ||
            feedQaReport.coinDelta !== -300 ||
            feedQaReport.grassDelta < 4.9 ||
            feedQaReport.grassDelta > 5
          ) {
            throw new Error(`饲料购买回归失败：${JSON.stringify(feedQaReport)}`);
          }
          await clickStageDirect(cdp, 780, 118);
          await moveStage(cdp, 255, 350);
          await delay(1_000);
          interactionReports.push(await captureScene(cdp, "desktop-feed-updated", "pasture"));
          await resetPasture(cdp);
        }
        if (wildQa) {
          for (const point of [[620, 610], [610, 610], [630, 610], [620, 600], [620, 620]]) {
            await moveStage(cdp, point[0], point[1]);
            await delay(500);
            await clickStageDirect(cdp, point[0], point[1]);
            await delay(1_500);
            if (responses.some((response) => response.url.includes("/api/manor/flash/pasture?mod=cgi_farm_get_userbeast"))) break;
          }
          await delay(4_000);
          interactionReports.push(await captureScene(cdp, "desktop-wild-pack", "pasture"));
        }
        await clickStage(cdp, 964, 39);
        await delay(2_500);
        interactionReports.push(await captureScene(cdp, "desktop-shop", "pasture"));
        if (shopDetailQa) {
          await clickStage(cdp, 360, 270);
          await delay(3_000);
          interactionReports.push(await captureScene(cdp, "desktop-shop-animal-detail", "pasture"));
        }
        await resetPasture(cdp);
        await clickStage(cdp, 905, 39);
        await delay(2_500);
        interactionReports.push(await captureScene(cdp, "desktop-warehouse", "pasture"));
        await resetPasture(cdp);
        await clickStage(cdp, 1023, 39);
        await delay(2_500);
        interactionReports.push(await captureScene(cdp, "desktop-decoration", "pasture"));
      }
    }

    const failedResponses = responses.filter((response) => response.status >= 400);
    const decorationRequestObserved = responses.some((response) =>
      response.url.includes("/api/manor/flash/farm?mod=item&act=getUserItems")
    );
    const seedShopRequestObserved = responses.some((response) =>
      response.url.includes("/api/manor/flash/farm?mod=usertool&act=getSeedInfo")
    );
    const pastureBootstrapObserved = responses.some((response) =>
      response.url.includes("/api/manor/flash/pasture?mod=cgi_enter")
    );
    const pastureShopRequestObserved = responses.some((response) =>
      response.url.includes("/api/manor/flash/pasture?mod=cgi_get_animals")
    );
    const pastureWarehouseRequestObserved = responses.some((response) =>
      response.url.includes("/api/manor/flash/pasture?mod=cgi_get_repertory")
    );
    const pastureDecorationRequestObserved = responses.some((response) =>
      response.url.includes("/api/manor/flash/pasture?mod=cgi_get_useritem")
    );
    const wildRequestObserved = responses.some((response) =>
      response.url.includes("/api/manor/flash/pasture?mod=cgi_farm_get_userbeast")
    );
    const ruffleErrors = consoleMessages.filter((message) => String(message.args[0] ?? "").includes("%cERROR%c"));
    const knownRuffleErrors = ruffleErrors.filter(isKnownRuffleError);
    const unexpectedRuffleErrors = ruffleErrors.filter((message) => !isKnownRuffleError(message));
    const reportPath = resolve(outputDirectory, "report.json");
    const report = { baseUrl, reports, interactionReports, feedQaReport, regressionQaReport, wildQa, wildRequestObserved, decorationRequestObserved, seedShopRequestObserved, pastureBootstrapObserved, pastureShopRequestObserved, pastureWarehouseRequestObserved, pastureDecorationRequestObserved, responses, failedResponses, failedLoads, consoleErrors, consoleMessages, runtimeExceptions, knownRuffleErrors, unexpectedRuffleErrors };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (failedResponses.length || failedLoads.length || consoleErrors.length || runtimeExceptions.length || unexpectedRuffleErrors.length || (!wildQa && (!decorationRequestObserved || !seedShopRequestObserved)) || !pastureBootstrapObserved || !pastureShopRequestObserved || !pastureWarehouseRequestObserved || !pastureDecorationRequestObserved || (wildQa && !wildRequestObserved) || [...reports, ...interactionReports].some((item) => !item.canvasIsColorful)) {
      throw new Error(`Manor V7 visual QA failed; see ${reportPath}`);
    }
    process.stdout.write(`${JSON.stringify({ reportPath, reports, interactionReports, feedQaReport, regressionQaReport, wildQa, wildRequestObserved, decorationRequestObserved, seedShopRequestObserved, pastureBootstrapObserved, pastureShopRequestObserved, pastureWarehouseRequestObserved, pastureDecorationRequestObserved, requestCount: responses.length, failedResponses, failedLoads, consoleErrors: consoleErrors.length, runtimeExceptions: runtimeExceptions.length, knownRuffleErrors: knownRuffleErrors.length, unexpectedRuffleErrors: unexpectedRuffleErrors.length }, null, 2)}\n`);
  } finally {
    cdp.close();
  }
} catch (error) {
  const detail = chromeError.trim();
  throw new Error(`${error instanceof Error ? error.message : String(error)}${detail ? `\nChrome: ${detail}` : ""}`);
} finally {
  await stopProcess(chrome);
}

async function captureScene(cdp, viewportName, scene) {
  const screenshotPath = resolve(outputDirectory, `${viewportName}-${scene}.png`);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  const page = await evaluate(cdp, `(() => {
    const stage = document.querySelector('.manor-flash-stage');
    const viewport = document.querySelector('.manor-flash-page');
    const player = document.querySelector('ruffle-player');
    const canvas = player?.shadowRoot?.querySelector('canvas');
    const rect = stage?.getBoundingClientRect();
    let pixelSample = null;
    try {
      if (canvas) {
        let data = null;
        let renderer = null;
        const context2d = canvas.getContext('2d');
        if (context2d) {
          data = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
          renderer = 'canvas';
        } else {
          const webgl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
          if (webgl) {
            data = new Uint8Array(webgl.drawingBufferWidth * webgl.drawingBufferHeight * 4);
            webgl.readPixels(0, 0, webgl.drawingBufferWidth, webgl.drawingBufferHeight, webgl.RGBA, webgl.UNSIGNED_BYTE, data);
            renderer = canvas.getContext('webgl2') ? 'webgl2' : 'webgl';
          }
        }
        if (!data) throw new Error('No readable canvas renderer was found');
        let opaque = 0;
        let colorful = 0;
        const stride = Math.max(4, Math.floor(data.length / 40000 / 4) * 4);
        for (let index = 0; index < data.length; index += stride) {
          if (data[index + 3] > 0) opaque += 1;
          if (Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) > 12) colorful += 1;
        }
        pixelSample = { renderer, opaque, colorful, stride };
      }
    } catch (error) {
      pixelSample = { error: String(error) };
    }
    return {
      stage: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      viewport: viewport ? { clientWidth: viewport.clientWidth, scrollWidth: viewport.scrollWidth, scrollLeft: viewport.scrollLeft } : null,
      player: player ? { width: player.clientWidth, height: player.clientHeight } : null,
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      pixelSample,
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
    };
  })()`);
  if (!page.pixelSample || page.pixelSample.opaque <= 1000 || page.pixelSample.colorful <= 1000) {
    page.pixelSample = await sampleScreenshot(cdp, screenshot.data, page.stage);
  }
  return {
    viewportName,
    scene,
    screenshotPath,
    ...page,
    canvasIsColorful: Boolean(page.pixelSample?.opaque > 1000 && page.pixelSample?.colorful > 1000)
  };
}

async function sampleScreenshot(cdp, pngBase64, stage) {
  if (!stage) throw new Error("Manor V7 stage bounds are unavailable for screenshot sampling");
  return evaluate(cdp, `(async () => {
    const image = new Image();
    image.src = ${JSON.stringify(`data:image/png;base64,${pngBase64}`)};
    await image.decode();
    const ratio = window.devicePixelRatio || 1;
    const left = Math.max(0, Math.floor(${stage.x} * ratio));
    const top = Math.max(0, Math.floor(${stage.y} * ratio));
    const right = Math.min(image.naturalWidth, Math.ceil(${stage.x + stage.width} * ratio));
    const bottom = Math.min(image.naturalHeight, Math.ceil(${stage.y + stage.height} * ratio));
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) throw new Error('The game stage is outside the captured screenshot');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Screenshot sampling canvas is unavailable');
    context.drawImage(image, left, top, width, height, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    let opaque = 0;
    let colorful = 0;
    const stride = Math.max(4, Math.floor(data.length / 40000 / 4) * 4);
    for (let index = 0; index < data.length; index += stride) {
      if (data[index + 3] > 0) opaque += 1;
      if (Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) > 12) colorful += 1;
    }
    return { renderer: 'screenshot', opaque, colorful, stride };
  })()`);
}

async function selectScene(cdp, scene) {
  const index = scene === "farm" ? 0 : 1;
  const label = scene === "farm" ? "农场" : "牧场";
  const bootstrapCount = sceneBootstrapResponseCount(scene);
  await evaluate(cdp, `(() => {
    const tabs = [...document.querySelectorAll('.manor-scene-tabs button')];
    const tab = tabs.find((candidate) => candidate.textContent?.includes(${JSON.stringify(label)}));
    if (!tab) throw new Error(${JSON.stringify(`${label} tab is missing`)});
    tab.click();
  })()`);
  await waitForExpression(cdp, `document.querySelectorAll('.manor-scene-tabs button')[${index}]?.getAttribute('aria-pressed') === 'true'`, 5_000);
  await waitForManor(cdp);
  await waitForSceneBootstrap(scene, bootstrapCount);
}

async function verifySceneNavigationRegression(cdp) {
  const pastureBootstrapCount = sceneBootstrapResponseCount("pasture");
  await clickStage(cdp, 48, 350);
  await waitForScene(cdp, "pasture", pastureBootstrapCount);
  const farmBootstrapCount = sceneBootstrapResponseCount("farm");
  for (const [x, y] of [[230, 490], [250, 490], [270, 490], [230, 510], [250, 510], [270, 510]]) {
    await clickStage(cdp, x, y);
    await delay(250);
    if (await sceneIsSelected(cdp, "farm")) break;
  }
  await waitForScene(cdp, "farm", farmBootstrapCount);

  const rapidSwitchBootstrapCount = sceneBootstrapResponseCount("farm");
  await evaluate(cdp, `(async () => {
    const tabs = [...document.querySelectorAll('.manor-scene-tabs button')].slice(0, 2);
    if (tabs.length !== 2) throw new Error('Manor scene buttons are missing');
    for (let index = 0; index < 20; index += 1) {
      tabs[index % 2 === 0 ? 1 : 0].click();
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
  })()`);
  await waitForScene(cdp, "farm", rapidSwitchBootstrapCount);
  const page = await evaluate(cdp, `(() => ({
    errorText: document.querySelector('.manor-flash-error')?.textContent ?? '',
    playerCount: document.querySelectorAll('ruffle-player').length,
    loaded: document.querySelector('ruffle-player')?.dataset.ruffleLoaded === 'true'
  }))()`);
  if (page.errorText.includes("Unable to borrow Ruffle instance") || page.playerCount !== 1 || !page.loaded) {
    throw new Error(`Ruffle 连续切换回归失败：${JSON.stringify(page)}`);
  }

  await selectScene(cdp, "pasture");
  await clickStage(cdp, 35, 108);
  await delay(1_000);
  await resetPasture(cdp);
  await clickStage(cdp, 78, 108);
  await delay(1_000);
  await resetPasture(cdp);
  await clickStage(cdp, 122, 108);
  await delay(1_000);
  const toolbarRequests = {
    profile: responses.some((response) => response.url.includes("/api/manor/flash/pasture?mod=cgi_get_user_info")),
    messages: responses.some((response) => response.url.includes("/api/manor/flash/pasture?mod=chat&act=getAllInfo")),
    progress: responses.some((response) => response.url.includes("/api/manor/flash/pasture?mod=cgi_get_Exp"))
  };
  if (Object.values(toolbarRequests).some((observed) => !observed)) {
    throw new Error(`牧场左上工具栏回归失败：${JSON.stringify(toolbarRequests)}`);
  }
  await selectScene(cdp, "farm");
  return {
    originalFarmToPasture: true,
    originalPastureToFarm: true,
    rapidSwitches: 20,
    toolbarRequests,
    ...page
  };
}

async function waitForScene(cdp, scene, bootstrapCount) {
  const index = scene === "farm" ? 0 : 1;
  await waitForExpression(cdp, `document.querySelectorAll('.manor-scene-tabs button')[${index}]?.getAttribute('aria-pressed') === 'true'`, 5_000);
  await waitForManor(cdp);
  await waitForSceneBootstrap(scene, bootstrapCount);
}

function sceneBootstrapResponseCount(scene) {
  const marker = scene === "farm"
    ? "/api/manor/flash/farm?qzonemod=user&act=run"
    : "/api/manor/flash/pasture?mod=cgi_enter";
  return responses.filter((response) => response.url.includes(marker) && response.status < 400).length;
}

async function waitForSceneBootstrap(scene, previousCount) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (sceneBootstrapResponseCount(scene) > previousCount) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${scene} scene bootstrap response`);
}

async function sceneIsSelected(cdp, scene) {
  const index = scene === "farm" ? 0 : 1;
  return evaluate(cdp, `document.querySelectorAll('.manor-scene-tabs button')[${index}]?.getAttribute('aria-pressed') === 'true'`);
}

async function resetPasture(cdp) {
  await selectScene(cdp, "farm");
  await delay(5_000);
  await selectScene(cdp, "pasture");
  await delay(10_000);
}

async function clickStage(cdp, relativeX, relativeY) {
  const { x, y } = await stagePoint(cdp, relativeX, relativeY);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

async function clickStageDirect(cdp, relativeX, relativeY) {
  const { x, y } = await stagePoint(cdp, relativeX, relativeY);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

async function moveStage(cdp, relativeX, relativeY) {
  const { x, y } = await stagePoint(cdp, relativeX, relativeY);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
}

async function stagePoint(cdp, relativeX, relativeY) {
  const stage = await evaluate(cdp, `(() => {
    const rect = document.querySelector('.manor-flash-stage')?.getBoundingClientRect();
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  })()`);
  if (!stage) throw new Error("Manor V7 stage is missing");
  const x = stage.x + relativeX * stage.width / 1100;
  const y = stage.y + relativeY * stage.height / 640;
  return { x, y };
}

async function authenticate(cdp) {
  const result = await evaluate(cdp, `(async () => {
    let status = await fetch('/api/account/status', { credentials: 'same-origin' }).then((response) => response.json());
    if (!status.initialized) {
      const response = await fetch('/api/account/bootstrap', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(${JSON.stringify(credentials)})
      });
      if (!response.ok) throw new Error(await response.text());
      status = await response.json();
    } else if (!status.authenticated) {
      const response = await fetch('/api/account/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(${JSON.stringify({ username: credentials.username, password: credentials.password })})
      });
      if (!response.ok) throw new Error(await response.text());
      status = await response.json();
    }
    return status;
  })()`);
  if (!result.authenticated) throw new Error("Visual QA account authentication failed");
}

async function prepareFeedQa(cdp) {
  const result = await evaluate(cdp, `(async () => {
    const initial = await fetch('/api/manor', { credentials: 'same-origin' }).then((response) => {
      if (!response.ok) throw new Error('庄园测试存档初始化失败');
      return response.json();
    });
    if (initial.coins >= 60) {
      return { coins: initial.coins, grass: initial.pasture.grass, revision: initial.revision };
    }
    const response = await fetch('/api/manor/actions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'claim-daily-package' })
    });
    if (!response.ok) throw new Error(await response.text());
    const view = await response.json();
    return { coins: view.coins, grass: view.pasture.grass, revision: view.revision };
  })()`);
  if (result.coins < 60) throw new Error("饲料回归账号的金币不足");
}

async function manorSnapshot(cdp) {
  return evaluate(cdp, `(async () => {
    const response = await fetch('/api/manor', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(await response.text());
    const view = await response.json();
    return { coins: view.coins, grass: view.pasture.grass, revision: view.revision };
  })()`);
}

async function manorDecorationSnapshot(cdp) {
  return evaluate(cdp, `(async () => {
    const response = await fetch('/api/manor', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(await response.text());
    const view = await response.json();
    return {
      selectedBoardId: view.farm.selectedBoardId,
      selectedAvatarId: view.farm.selectedAvatarId,
      revision: view.revision
    };
  })()`);
}

async function clearAvatarQa(cdp) {
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/mync.php?mod=item&act=deactiveItem', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'mod=qqshow&act=deactiveItem&id=0'
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  })()`);
  if (String(result.code) !== "1") throw new Error(`农场形象取消回归失败：${JSON.stringify(result)}`);
  const snapshot = await manorDecorationSnapshot(cdp);
  if (snapshot.selectedAvatarId !== null) {
    throw new Error(`农场形象取消未清理存档：${JSON.stringify(snapshot)}`);
  }
}

async function waitForManor(cdp) {
  await waitForExpression(
    cdp,
    `document.querySelector('ruffle-player')?.dataset.ruffleLoaded === 'true'`,
    30_000
  );
}

async function setViewport(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height
  });
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitForExpression(cdp, `document.readyState === 'complete'`, 15_000);
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
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
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
  const server = createServer();
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

async function stopProcess(process) {
  if (!process.pid || process.exitCode !== null) return;
  process.kill();
  await Promise.race([new Promise((resolveExit) => process.once("exit", resolveExit)), delay(2_000)]);
  if (process.exitCode !== null) return;
  const taskkill = spawn("taskkill.exe", ["/pid", String(process.pid), "/t", "/f"], {
    stdio: "ignore",
    windowsHide: true
  });
  await Promise.race([new Promise((resolveExit) => taskkill.once("exit", resolveExit)), delay(3_000)]);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function isKnownRuffleError(message) {
  const text = String(message.args[0] ?? "");
  return /Variable (?:NLeftArrow|NRightArrow|BMill1|BSuperMarket) is not defined\./.test(text)
    || /qfa\.LoaderEvent\.COMPLETE[\s\S]+accessing field: progressText/.test(text)
    || /Error dispatching event "rollOver":[\s\S]+module::Master2\/onMouseOver\(\)\. Expected 0, got 1\./.test(text);
}
