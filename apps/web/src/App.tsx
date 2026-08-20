import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AccountPage } from "./platform/AccountPage";
import { AccountProvider } from "./platform/AccountContext";
import { HomePage } from "./platform/HomePage";
import { RequireAccount } from "./platform/RequireAccount";
import { SettingsPage } from "./platform/SettingsPage";
import "./games/clocktower/theme.css";
import "./games/gomoku/theme.css";
import "./games/manor/theme.css";
import "./games/puzzles.css";
import "./games/minesweeper/theme.css";
import "./games/poker/theme.css";
import "./games/sudoku/theme.css";
import "./games/turtle-soup/theme.css";

const ClocktowerEntryPage = lazy(() =>
  import("./games/clocktower/EntryPage").then(({ ClocktowerEntryPage }) => ({
    default: ClocktowerEntryPage
  }))
);
const ClocktowerRoomPage = lazy(() =>
  import("./games/clocktower/RoomPage").then(({ ClocktowerRoomPage }) => ({
    default: ClocktowerRoomPage
  }))
);
const PokerEntryPage = lazy(() =>
  import("./games/poker/EntryPage").then(({ PokerEntryPage }) => ({ default: PokerEntryPage }))
);
const PokerRoomPage = lazy(() =>
  import("./games/poker/RoomPage").then(({ PokerRoomPage }) => ({ default: PokerRoomPage }))
);
const TurtleSoupEntryPage = lazy(() =>
  import("./games/turtle-soup/EntryPage").then(({ TurtleSoupEntryPage }) => ({
    default: TurtleSoupEntryPage
  }))
);
const TurtleSoupRoomPage = lazy(() =>
  import("./games/turtle-soup/RoomPage").then(({ TurtleSoupRoomPage }) => ({
    default: TurtleSoupRoomPage
  }))
);
const TurtleSoupPromptLabPage = lazy(() =>
  import("./games/turtle-soup/PromptLabPage").then(({ TurtleSoupPromptLabPage }) => ({
    default: TurtleSoupPromptLabPage
  }))
);
const MinesweeperPage = lazy(() =>
  import("./games/minesweeper/Page").then(({ MinesweeperPage }) => ({ default: MinesweeperPage }))
);
const SudokuPage = lazy(() =>
  import("./games/sudoku/Page").then(({ SudokuPage }) => ({ default: SudokuPage }))
);
const GomokuPage = lazy(() =>
  import("./games/gomoku/Page").then(({ GomokuPage }) => ({ default: GomokuPage }))
);
const GomokuReplayPage = lazy(() =>
  import("./games/gomoku/ReplayPage").then(({ GomokuReplayPage }) => ({
    default: GomokuReplayPage
  }))
);
const ManorPage = lazy(() =>
  import("./games/manor/Page").then(({ ManorPage }) => ({ default: ManorPage }))
);

export default function App() {
  return (
    <AccountProvider>
      <Suspense fallback={<div className="route-loading">加载中...</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route element={<RequireAccount />}>
            <Route path="/clocktower" element={<ClocktowerEntryPage />} />
            <Route path="/clocktower/room/:roomCode" element={<ClocktowerRoomPage />} />
            <Route path="/poker" element={<PokerEntryPage />} />
            <Route path="/poker/room/:roomCode" element={<PokerRoomPage />} />
            <Route path="/turtle-soup" element={<TurtleSoupEntryPage />} />
            <Route path="/turtle-soup/room/:roomCode" element={<TurtleSoupRoomPage />} />
            <Route path="/manor" element={<ManorPage />} />
          </Route>
          <Route path="/turtle-soup/lab" element={<TurtleSoupPromptLabPage />} />
          <Route path="/minesweeper" element={<MinesweeperPage />} />
          <Route path="/sudoku" element={<SudokuPage />} />
          <Route path="/gomoku" element={<GomokuPage tab="play" />} />
          <Route path="/gomoku/puzzles" element={<GomokuPage tab="puzzles" />} />
          <Route path="/gomoku/learn" element={<GomokuPage tab="learn" />} />
          <Route path="/gomoku/replay/:matchId" element={<GomokuReplayPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AccountProvider>
  );
}
