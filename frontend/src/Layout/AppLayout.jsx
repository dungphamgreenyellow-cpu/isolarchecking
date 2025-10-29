import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EFF6FF] to-white text-slate-800">
      {/* === Header cố định === */}
      <div className="fixed top-0 left-0 w-full z-50">
        <Header />
      </div>

      {/* === Nội dung === */}
      <div
        className="flex flex-col items-center w-full max-w-7xl mx-auto px-6 pb-16"
        style={{ paddingTop: "84px" }} // 👈 giảm từ 90px xuống 84px cho cân
      >
        <Outlet />
      </div>
    </div>
  );
}
