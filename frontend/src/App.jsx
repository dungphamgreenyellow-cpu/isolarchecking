import React from "react";
import { Routes, Route } from "react-router-dom";
import AppLayout from "./Layout/AppLayout.jsx";
import HomePage from "./pages/HomePage";
import Report from "./pages/Report";


export default function App() {
  return (
    <Routes>
      {/* Layout chung có Header */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/report" element={<Report />} />
      </Route>
    </Routes>
  );
}
