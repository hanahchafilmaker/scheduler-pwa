import React from "react";
import ReactDOM from "react-dom/client";
import AdminApp from "./admin/App.jsx";
import "./index.css";
import "./styles.css";   // 👈 이거 추가

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);