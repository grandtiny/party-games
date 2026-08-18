import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
// 以下 CSS 导入顺序即打包后的级联顺序：App 内的主题样式在前，
// 平台共享样式居中，clocktower 房间结构样式最后（对应原 styles.css 中游戏规则靠后的位置）。调整顺序会改变主题覆盖行为。
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/room.css";
import "./styles/home.css";
import "./styles/account.css";
import "./styles/settings.css";
import "./games/clocktower/room.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
