import { Route, Routes } from "react-router-dom";
import { HomePage } from "./HomePage";
import { UnitEditorPage } from "./UnitEditorPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/unit/:unitId" element={<UnitEditorPage />} />
    </Routes>
  );
}
