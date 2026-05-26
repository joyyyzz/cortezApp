import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useIonRouter } from "@ionic/react";

// ✅ I-define dito para madaling palitan kung mag-move ng server
const BASE_URL = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php";

const Login = () => {
  const router = useIonRouter();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(""); // clear error on type
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${BASE_URL}/API_user/loginProcess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      // ✅ Try to parse JSON even on 500 for better error messages
      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        console.error("Non-JSON response:", text);
        setError("Server error. Check PHP logs.");
        return;
      }

      if (data.status === "success") {
        const user_id  = data.user_id  ?? data.data?.user_id  ?? data.user?.user_id  ?? "";
        const username = data.username ?? data.data?.username ?? data.user?.username ?? formData.username;

        localStorage.setItem("user_id",  String(user_id));
        localStorage.setItem("username", username);
        localStorage.setItem("role",     data.role ?? "");

        if (data.role === "admin") {
          router.push("/dashboard");
        } else {
          router.push("/userdashboard");
        }
      } else {
        setError(data.message || "Invalid username or password");
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError("Cannot connect to server. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "linear-gradient(180deg, #4e73df 10%, #224abe 100%)", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "0 15px" }}>
        <div style={{ width: "100%", maxWidth: "960px" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: "0.35rem",
              boxShadow: "0 1rem 3rem rgba(0,0,0,0.175)",
              overflow: "hidden",
              margin: "3rem 0",
              display: "flex",
            }}
          >
            {/* Left — empty white space */}
            <div style={{ flex: "0 0 50%" }} />

            {/* Right — form */}
            <div style={{ flex: "0 0 50%", padding: "2.5rem" }}>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#5a5c69", marginBottom: 0 }}>
                  Welcome Back!
                </h1>
              </div>

              {/* ✅ Error message display */}
              {error && (
                <div style={{
                  background: "#fde8e8", color: "#c0392b",
                  padding: "0.6rem 1rem", borderRadius: "0.35rem",
                  marginBottom: "1rem", fontSize: "0.85rem", textAlign: "center"
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "1rem" }}>
                  <input
                    type="text"
                    name="username"
                    placeholder="Enter username..."
                    value={formData.username}
                    onChange={handleChange}
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
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
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
                  type="submit"
                  disabled={loading}
                  style={{
                    display: "block", width: "100%", padding: "0.75rem",
                    backgroundColor: loading ? "#a0b4f0" : "#4e73df",
                    color: "#fff", border: "none",
                    borderRadius: "10rem", fontSize: "0.9rem", fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "background-color 0.2s ease-in-out",
                  }}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>

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