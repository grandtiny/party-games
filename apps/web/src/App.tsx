import { Navigate, Route, Routes } from "react-router-dom";
import { ClocktowerEntryPage, ClocktowerRoomPage } from "./games/clocktower";
import { MinesweeperPage } from "./games/minesweeper";
import { PokerEntryPage, PokerRoomPage } from "./games/poker";
import { SudokuPage } from "./games/sudoku";
import { HomePage } from "./platform/HomePage";
import { SettingsPage } from "./platform/SettingsPage";
import "./games/clocktower/theme.css";
import "./games/puzzles.css";
import "./games/minesweeper/theme.css";
import "./games/poker/theme.css";
import "./games/sudoku/theme.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/clocktower" element={<ClocktowerEntryPage />} />
      <Route path="/clocktower/room/:roomCode" element={<ClocktowerRoomPage />} />
      <Route path="/poker" element={<PokerEntryPage />} />
      <Route path="/poker/room/:roomCode" element={<PokerRoomPage />} />
      <Route path="/minesweeper" element={<MinesweeperPage />} />
      <Route path="/sudoku" element={<SudokuPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
