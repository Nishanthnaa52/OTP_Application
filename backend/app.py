"""
OTP Verification Backend — Flask + Redis

This is an educational application that demonstrates how Redis works
as a temporary data store for OTP (One-Time Password) verification.

Redis Operations Used:
  - SETEX  → Store OTP with an expiration time
  - GET    → Retrieve OTP for verification
  - DELETE → Remove OTP after successful verification
  - EXISTS → Check if an OTP key exists
  - TTL    → Get remaining time-to-live for an OTP key
"""

import os
import re
import random
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import redis

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Allow React dev server (http://localhost:5173) to call our API
CORS(app)

# ---------------------------------------------------------------------------
# Redis Connection
# ---------------------------------------------------------------------------
# We read connection details from environment variables so that
# credentials are never hardcoded in the source code.

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True  # So we get strings back instead of bytes
)

# OTP settings
OTP_EXPIRY_SECONDS = 300  # 5 minutes


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_valid_email(email: str) -> bool:
    """Basic email format validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def generate_otp() -> str:
    """Generate a random 6-digit OTP string."""
    return str(random.randint(100000, 999999))


# ---------------------------------------------------------------------------
# Redis Connection Test
# ---------------------------------------------------------------------------
# We test the Redis connection at startup so the developer gets an immediate,
# clear error if Redis is not running.

def test_redis_connection():
    """Ping Redis to verify it is reachable."""
    try:
        redis_client.ping()
        print("✅  Redis connection successful!")
        print(f"   Host : {os.getenv('REDIS_HOST', 'localhost')}")
        print(f"   Port : {os.getenv('REDIS_PORT', 6379)}")
        print(f"   DB   : {os.getenv('REDIS_DB', 0)}")
    except redis.ConnectionError:
        print("=" * 60)
        print("❌  ERROR: Cannot connect to Redis!")
        print()
        print("   Make sure the Redis server is running.")
        print()
        print("   Quick start with Docker:")
        print("     docker run -d --name redis-otp -p 6379:6379 redis")
        print()
        print("   Check if it's running:")
        print("     docker ps")
        print("=" * 60)
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

# ── POST /api/send-otp ────────────────────────────────────────────────────
@app.route("/api/send-otp", methods=["POST"])
def send_otp():
    """
    Generate a 6-digit OTP and store it in Redis with a 5-minute TTL.

    Redis operation used:
      SETEX otp:<email> 300 <otp>
        ↳ Sets the key, its value, AND an expiry in one atomic command.
        ↳ If the key already exists it is overwritten (useful for Resend).

    Request JSON:
      { "email": "user@example.com" }

    Response JSON:
      { "message": "...", "otp": "482913", "expires_in": 300 }
    """
    try:
        # --- Check Redis availability first ---
        redis_client.ping()
    except redis.ConnectionError:
        return jsonify({"error": "Redis server is unavailable. Please make sure Redis is running."}), 503

    data = request.get_json()

    # --- Input validation ---
    if not data or not data.get("email"):
        return jsonify({"error": "Email is required."}), 400

    email = data["email"].strip().lower()

    if not is_valid_email(email):
        return jsonify({"error": "Please enter a valid email address."}), 400

    # --- Generate OTP ---
    otp = generate_otp()

    # --- Store OTP in Redis ---------------------------------------------------
    # SETEX sets a key with an expiration time (TTL) in one command.
    #   Key   : otp:user@example.com
    #   TTL   : 300 seconds (5 minutes)
    #   Value : 482913 (the 6-digit OTP)
    #
    # After 300 seconds Redis will AUTOMATICALLY delete the key.
    # If the key already exists (e.g. Resend), Redis overwrites it.
    # --------------------------------------------------------------------------
    redis_key = f"otp:{email}"
    redis_client.setex(redis_key, OTP_EXPIRY_SECONDS, otp)

    # --- DEV ONLY: Print OTP to terminal for learning / debugging ---
    print(f"\n📩  [DEV] OTP for {email}: {otp}")
    print(f"   Redis Key   : {redis_key}")
    print(f"   Redis Value : {otp}")
    print(f"   Redis TTL   : {OTP_EXPIRY_SECONDS}s\n")

    return jsonify({
        "message": "OTP generated successfully.",
        "otp": otp,            # ⚠️  DEVELOPMENT ONLY — never expose in production!
        "expires_in": OTP_EXPIRY_SECONDS,
        "redis_key": redis_key  # Shown for learning purposes
    }), 200


# ── POST /api/verify-otp ──────────────────────────────────────────────────
@app.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    """
    Verify the OTP entered by the user against the value in Redis.

    Redis operations used:
      GET otp:<email>       → Retrieve the stored OTP
      DELETE otp:<email>    → Remove the key after successful verification

    Request JSON:
      { "email": "user@example.com", "otp": "482913" }
    """
    try:
        redis_client.ping()
    except redis.ConnectionError:
        return jsonify({"error": "Redis server is unavailable. Please make sure Redis is running."}), 503

    data = request.get_json()

    # --- Input validation ---
    if not data or not data.get("email"):
        return jsonify({"error": "Email is required."}), 400

    if not data.get("otp"):
        return jsonify({"error": "OTP is required."}), 400

    email = data["email"].strip().lower()
    user_otp = data["otp"].strip()

    if not is_valid_email(email):
        return jsonify({"error": "Please enter a valid email address."}), 400

    # OTP must be exactly 6 digits
    if not re.match(r'^\d{6}$', user_otp):
        return jsonify({"error": "OTP must be exactly 6 digits."}), 400

    redis_key = f"otp:{email}"

    # --- GET: Retrieve the OTP from Redis -------------------------------------
    # redis_client.get(key) returns the value if the key exists,
    # or None if the key has expired or was never set.
    # --------------------------------------------------------------------------
    stored_otp = redis_client.get(redis_key)

    print(f"\n🔍  [DEV] Verifying OTP for {email}")
    print(f"   User entered : {user_otp}")
    print(f"   Stored in Redis : {stored_otp}")

    # --- Check if OTP exists (it may have expired) ---
    if stored_otp is None:
        print("   ⏰  OTP expired or does not exist.\n")
        return jsonify({
            "error": "OTP has expired or does not exist. Please request a new OTP.",
            "redis_operation": "GET returned None — key expired or missing"
        }), 410  # 410 Gone

    # --- Compare OTPs ---
    if stored_otp != user_otp:
        print("   ❌  Incorrect OTP.\n")
        return jsonify({
            "error": "Incorrect OTP. Please try again.",
            "redis_operation": "GET returned a value but it did not match"
        }), 400

    # --- DELETE: Remove OTP from Redis after successful verification ----------
    # Once verified, the OTP should not be reusable.
    # redis_client.delete(key) removes the key from Redis immediately.
    # --------------------------------------------------------------------------
    redis_client.delete(redis_key)

    print("   ✅  OTP verified! Key deleted from Redis.\n")

    return jsonify({
        "message": "OTP verified successfully!",
        "redis_operation": "DELETE — key removed after successful verification"
    }), 200


# ── GET /api/otp-status ───────────────────────────────────────────────────
@app.route("/api/otp-status", methods=["GET"])
def otp_status():
    """
    Educational endpoint that shows the current Redis state for an OTP key.

    Redis operations used:
      EXISTS otp:<email>  → Returns 1 if key exists, 0 if not
      TTL otp:<email>     → Returns remaining seconds, or:
                              -1  if key exists but has no expiry
                              -2  if key does not exist

    Query parameter:
      ?email=user@example.com
    """
    try:
        redis_client.ping()
    except redis.ConnectionError:
        return jsonify({"error": "Redis server is unavailable. Please make sure Redis is running."}), 503

    email = request.args.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email query parameter is required."}), 400

    redis_key = f"otp:{email}"

    # --- EXISTS: Check whether the key is present in Redis --------------------
    # Returns True (1) if the key exists, False (0) if it does not.
    # --------------------------------------------------------------------------
    key_exists = redis_client.exists(redis_key)

    # --- TTL: Get the remaining time-to-live in seconds -----------------------
    # Returns:
    #   > 0   → seconds remaining before the key expires
    #    -1   → key exists but has NO expiration set
    #    -2   → key does NOT exist
    # --------------------------------------------------------------------------
    ttl = redis_client.ttl(redis_key)

    return jsonify({
        "exists": bool(key_exists),
        "ttl": ttl,
        "redis_key": redis_key,
        "redis_operations": {
            "EXISTS": f"EXISTS {redis_key} → {key_exists}",
            "TTL": f"TTL {redis_key} → {ttl}"
        }
    }), 200


# ── GET /api/health ───────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    """Quick health check for the API and Redis."""
    try:
        redis_client.ping()
        return jsonify({"status": "healthy", "redis": "connected"}), 200
    except redis.ConnectionError:
        return jsonify({"status": "unhealthy", "redis": "disconnected"}), 503


# ---------------------------------------------------------------------------
# Application Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  OTP Verification App — Flask + Redis")
    print("  Educational project to learn Redis")
    print("=" * 60 + "\n")

    # Test Redis before starting the server
    test_redis_connection()

    print("\n🚀  Starting Flask server on http://localhost:5000\n")
    app.run(debug=True, port=5000)
