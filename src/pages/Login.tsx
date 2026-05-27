import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useIonRouter } from "@ionic/react";
import { CapacitorHttp } from "@capacitor/core";

const BASE_URL = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php";

const Login = () => {
  const router = useIonRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await CapacitorHttp.post({
        url: `${BASE_URL}/API_user/loginProcess`,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        data: { username: username.trim(), password: password },
      });

      const data = response.data;

      if (data.status === "success") {
        const user_id = data.user_id ?? data.data?.user_id ?? data.user?.user_id ?? "";
        const uname = data.username ?? data.data?.username ?? data.user?.username ?? username;

        localStorage.setItem("user_id", String(user_id));
        localStorage.setItem("username", uname);
        localStorage.setItem("role", data.role ?? "");

        if (data.role === "admin") {
          router.push("/dashboard");
        } else {
          router.push("/userdashboard");
        }
      } else {
        setError(data.message || "Invalid username or password");
      }
    } catch (err) {
      setError("Cannot connect to server: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "linear-gradient(180deg, #4e73df 10%, #224abe 100%)", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "0 15px" }}>
        <div style={{ width: "100%", maxWidth: "960px" }}>
          <div style={{
            background: "#fff", borderRadius: "0.35rem",
            boxShadow: "0 1rem 3rem rgba(0,0,0,0.175)",
            overflow: "hidden", margin: "3rem 0", display: "flex",
          }}>
            <div style={{ flex: "0 0 50%" }} />
            <div style={{ flex: "0 0 50%", padding: "2.5rem" }}>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#5a5c69", marginBottom: 0 }}>
                  Welcome Back!
                </h1>
              </div>

              {error && (
                <div style={{
                  background: "#fde8e8", color: "#c0392b",
                  padding: "0.6rem 1rem", borderRadius: "0.35rem",
                  marginBottom: "1rem", fontSize: "0.85rem", textAlign: "center"
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="text"
                  placeholder="Enter username..."
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  disabled={loading}
                  style={{
                    display: "block", width: "100%",
                    padding: "0.75rem 1.25rem", fontSize: "0.85rem",
                    borderRadius: "10rem", border: "1px solid #d1d3e2",
                    outline: "none", boxSizing: "border-box",
                    backgroundColor: "#fff", color: "#6e707e",
                  }}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  disabled={loading}
                  style={{
                    display: "block", width: "100%",
                    padding: "0.75rem 1.25rem", fontSize: "0.85rem",
                    borderRadius: "10rem", border: "1px solid #d1d3e2",
                    outline: "none", boxSizing: "border-box",
                    backgroundColor: "#fff", color: "#6e707e",
                  }}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  display: "block", width: "100%", padding: "0.75rem",
                  backgroundColor: loading ? "#a0b4f0" : "#4e73df",
                  color: "#fff", border: "none",
                  borderRadius: "10rem", fontSize: "0.9rem", fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              <hr style={{ margin: "1.5rem 0" }} />

              <div style={{ textAlign: "center" }}>
                <Link to="/register" style={{ color: "#4e73df", fontSize: "0.85rem" }}>
                  Create an Account!
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;