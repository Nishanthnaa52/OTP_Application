import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:5000/api";

function App() {
  // ── State ───────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");           // shown for learning
  const [step, setStep] = useState("email");           // email → otp → done
  const [message, setMessage] = useState(null);        // { text, type }
  const [loading, setLoading] = useState(false);

  // Countdown
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  // Redis status panel
  const [redisStatus, setRedisStatus] = useState(null);
  const statusIntervalRef = useRef(null);

  // Redis learning panel
  const [redisKey, setRedisKey] = useState("");
  const [lastOperation, setLastOperation] = useState("—");

  // ── Helpers ─────────────────────────────────────────────────────────────
  const showMessage = (text, type = "info") => setMessage({ text, type });
  const clearMessage = () => setMessage(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Countdown timer (visual only — real expiry is Redis TTL) ────────────
  const startCountdown = useCallback((seconds) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Fetch Redis status every 3 seconds ──────────────────────────────────
  const startStatusPolling = useCallback((emailAddr) => {
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);

    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE}/otp-status`, {
          params: { email: emailAddr },
        });
        setRedisStatus(res.data);

        // Sync countdown with real TTL if significantly different
        if (res.data.ttl > 0) {
          setCountdown((prev) => {
            if (Math.abs(prev - res.data.ttl) > 5) return res.data.ttl;
            return prev;
          });
        }

        // If TTL expired while we're on the OTP step, show expiry message
        if (!res.data.exists || res.data.ttl <= 0) {
          setCountdown(0);
        }
      } catch {
        // silently ignore polling errors
      }
    };

    fetchStatus();
    statusIntervalRef.current = setInterval(fetchStatus, 3000);
  }, []);

  const stopStatusPolling = () => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      stopStatusPolling();
    };
  }, []);

  // ── Send OTP ────────────────────────────────────────────────────────────
  const handleSendOtp = async (isResend = false) => {
    clearMessage();

    if (!email.trim()) {
      showMessage("Please enter your email address.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/send-otp`, { email: email.trim() });

      setDevOtp(res.data.otp);
      setRedisKey(res.data.redis_key);
      setLastOperation("SETEX");
      setStep("otp");
      setOtp("");

      startCountdown(res.data.expires_in);
      startStatusPolling(email.trim());

      showMessage(
        isResend
          ? "New OTP generated! Redis key overwritten with new value & TTL."
          : "OTP generated successfully!",
        "success"
      );
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Failed to send OTP. Is the server running?";
      showMessage(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ──────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    clearMessage();

    if (!otp.trim()) {
      showMessage("Please enter the OTP.", "error");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      showMessage("OTP must be exactly 6 digits.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/verify-otp`, {
        email: email.trim(),
        otp: otp.trim(),
      });

      setLastOperation("DELETE");
      setStep("done");
      stopStatusPolling();
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
      setRedisStatus({ exists: false, ttl: -2 });

      showMessage(res.data.message, "success");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Verification failed.";
      const status = err.response?.status;

      setLastOperation("GET");

      if (status === 410) {
        showMessage(errorMsg, "warning");
      } else {
        showMessage(errorMsg, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const handleReset = () => {
    setEmail("");
    setOtp("");
    setDevOtp("");
    setStep("email");
    setMessage(null);
    setRedisStatus(null);
    setRedisKey("");
    setLastOperation("—");
    setCountdown(0);
    stopStatusPolling();
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // ── Determine if OTP has expired ────────────────────────────────────────
  const isExpired = step === "otp" && countdown === 0 && redisStatus && !redisStatus.exists;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      {/* Background blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1>OTP Verification</h1>
          <p className="subtitle">Learn how Redis powers temporary data storage</p>
        </header>

        {/* Message banner */}
        {message && (
          <div className={`message message-${message.type}`}>
            <span className="message-icon">
              {message.type === "success" && "✓"}
              {message.type === "error" && "✕"}
              {message.type === "warning" && "⚠"}
              {message.type === "info" && "ℹ"}
            </span>
            {message.text}
          </div>
        )}

        {/* ── Step 1: Email Input ───────────────────────────────────── */}
        {step === "email" && (
          <section className="card">
            <h2>Step 1 — Enter Your Email</h2>
            <div className="input-group">
              <label htmlFor="email-input">Email Address</label>
              <input
                id="email-input"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              />
            </div>
            <button
              id="send-otp-btn"
              className="btn btn-primary"
              onClick={() => handleSendOtp(false)}
              disabled={loading}
            >
              {loading ? <span className="spinner"></span> : null}
              Send OTP
            </button>
          </section>
        )}

        {/* ── Step 2: OTP Verification ─────────────────────────────── */}
        {step === "otp" && (
          <>
            {/* Dev OTP display */}
            <section className="card card-dev">
              <div className="dev-badge">⚠ DEVELOPMENT ONLY</div>
              <p className="dev-otp-label">Generated OTP</p>
              <p className="dev-otp-value">{devOtp}</p>
              <div className="countdown-wrapper">
                <div className={`countdown ${countdown <= 30 ? "countdown-danger" : ""}`}>
                  {formatTime(countdown)}
                </div>
                <p className="countdown-note">
                  Visual timer only — real expiry is controlled by Redis TTL
                </p>
              </div>
            </section>

            {/* OTP input */}
            <section className="card">
              <h2>Step 2 — Enter OTP</h2>

              {isExpired ? (
                <div className="expired-notice">
                  <span className="expired-icon">⏰</span>
                  <p>OTP expired. Please request a new OTP.</p>
                  <button className="btn btn-secondary" onClick={() => handleSendOtp(true)}>
                    Resend OTP
                  </button>
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label htmlFor="otp-input">6-Digit OTP</label>
                    <input
                      id="otp-input"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                    />
                  </div>
                  <div className="btn-row">
                    <button
                      id="verify-otp-btn"
                      className="btn btn-primary"
                      onClick={handleVerifyOtp}
                      disabled={loading}
                    >
                      {loading ? <span className="spinner"></span> : null}
                      Verify OTP
                    </button>
                    <button
                      id="resend-otp-btn"
                      className="btn btn-ghost"
                      onClick={() => handleSendOtp(true)}
                      disabled={loading}
                    >
                      Resend OTP
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Redis Status */}
            {redisStatus && (
              <section className="card card-status">
                <h2>
                  <span className="redis-dot"></span>
                  Redis Status
                </h2>
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">OTP Exists</span>
                    <span className={`status-value ${redisStatus.exists ? "val-yes" : "val-no"}`}>
                      {redisStatus.exists ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">TTL</span>
                    <span className="status-value">
                      {redisStatus.ttl > 0 ? `${redisStatus.ttl}s` : redisStatus.ttl === -2 ? "Key gone" : "No expiry"}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Step 3: Success ──────────────────────────────────────── */}
        {step === "done" && (
          <section className="card card-success">
            <div className="success-icon">✓</div>
            <h2>Verification Successful!</h2>
            <p>Your OTP was verified and the Redis key has been deleted.</p>
            <p className="success-detail">
              <code>DELETE otp:{email.trim().toLowerCase()}</code> was executed.
            </p>
            <button className="btn btn-primary" onClick={handleReset}>
              Start Over
            </button>
          </section>
        )}

        {/* ── Redis Learning Panel ─────────────────────────────────── */}
        {step !== "email" && (
          <section className="card card-learn">
            <h2>
              <span className="learn-icon">📚</span>
              How Redis Is Being Used
            </h2>
            <div className="learn-grid">
              <div className="learn-item">
                <span className="learn-label">Redis Key</span>
                <code className="learn-value">{redisKey || "—"}</code>
              </div>
              <div className="learn-item">
                <span className="learn-label">Redis Value</span>
                <code className="learn-value">{devOtp || "—"}</code>
              </div>
              <div className="learn-item">
                <span className="learn-label">TTL</span>
                <code className="learn-value">
                  {redisStatus ? (redisStatus.ttl > 0 ? `${redisStatus.ttl} seconds` : "expired / deleted") : "—"}
                </code>
              </div>
              <div className="learn-item">
                <span className="learn-label">Last Operation</span>
                <code className="learn-value">{lastOperation}</code>
              </div>
              <div className="learn-item">
                <span className="learn-label">Storage</span>
                <code className="learn-value">Redis Memory (RAM)</code>
              </div>
            </div>

            <div className="learn-command">
              <p className="learn-command-title">Equivalent Redis CLI Command</p>
              <code className="learn-command-code">
                {lastOperation === "SETEX" && `SETEX ${redisKey} 300 ${devOtp}`}
                {lastOperation === "GET" && `GET ${redisKey}`}
                {lastOperation === "DELETE" && `DEL ${redisKey}`}
                {lastOperation === "—" && "—"}
              </code>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <p>OTP Verification Demo — Learn Redis with Flask + React</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
