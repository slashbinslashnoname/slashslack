import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useMe, useSettings } from "./lib/queries";
import { applyFromSettings } from "./lib/theme";
import { SocketProvider } from "./lib/socket";
import { InstallPrompt } from "./components/InstallPrompt";
import { Login } from "./pages/Login";
import { Chat } from "./pages/Chat";
import { Admin } from "./pages/Admin";

export default function App() {
  const me = useMe();
  const { data: settings } = useSettings();

  // apply theme tokens whenever settings load/change
  useEffect(() => {
    if (settings) applyFromSettings(settings);
  }, [settings]);

  // when logged out, keep the homepage URL at "/" (preserve ?invite=)
  useEffect(() => {
    if (!me.isLoading && !me.data && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/" + window.location.search);
    }
  }, [me.isLoading, me.data]);

  if (me.isLoading) {
    return <div className="h-full flex items-center justify-center text-muted">Loading…</div>;
  }

  if (!me.data) {
    return (
      <>
        <Login />
        <InstallPrompt />
      </>
    );
  }

  return (
    <SocketProvider user={me.data}>
      <Routes>
        <Route path="/" element={<Chat me={me.data} />} />
        <Route path="/c/:channelId" element={<Chat me={me.data} />} />
        <Route path="/c/:channelId/:messageId" element={<Chat me={me.data} />} />
        <Route path="/dm/:dmId" element={<Chat me={me.data} />} />
        <Route path="/dm/:dmId/:messageId" element={<Chat me={me.data} />} />
        <Route
          path="/admin"
          element={me.data.role === "admin" ? <Admin me={me.data} /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <InstallPrompt />
    </SocketProvider>
  );
}
