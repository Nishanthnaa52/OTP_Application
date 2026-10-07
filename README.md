# 🔐 OTP Verification App — Learn Redis with Flask + React

A beginner-friendly, full-stack OTP (One-Time Password) verification application built to teach you how **Redis** works in a real project.

```
React (Frontend)
  │
  │  HTTP requests (Axios)
  ↓
Flask (Backend)
  │
  │  Redis commands (SET, GET, TTL, DEL, EXISTS)
  ↓
Redis (In-Memory Data Store)
  │
  ├── otp:user@example.com  =  482913
  └── TTL: 300 seconds (auto-expires)
```

---

## 📖 Table of Contents

1. [What is Redis?](#1-what-is-redis)
2. [Why Redis for OTP?](#2-why-redis-for-otp)
3. [Redis vs MySQL](#3-redis-vs-mysql)
4. [Prerequisites](#4-prerequisites)
5. [How to Start Redis](#5-how-to-start-redis)
6. [How to Start the Backend (Flask)](#6-how-to-start-the-backend-flask)
7. [How to Start the Frontend (React)](#7-how-to-start-the-frontend-react)
8. [API Documentation](#8-api-documentation)
9. [Redis Commands Explained](#9-redis-commands-explained)
10. [TTL Explained](#10-ttl-explained)
11. [What Happens When OTP Expires?](#11-what-happens-when-otp-expires)
12. [What Happens When OTP Is Verified?](#12-what-happens-when-otp-is-verified)
13. [Inspecting Redis with Redis CLI](#13-inspecting-redis-with-redis-cli)
14. [Common Redis Errors](#14-common-redis-errors)
15. [What I Learned](#15-what-i-learned)

---

## 1. What is Redis?

**Redis** (Remote Dictionary Server) is an **in-memory key-value data store**. Think of it like a giant dictionary (hash map) that lives in your computer's RAM.

| Feature         | Description                                    |
| --------------- | ---------------------------------------------- |
| **Speed**       | Data is stored in RAM → extremely fast         |
| **Data Model**  | Key-value pairs (like a dictionary)            |
| **Persistence** | Optional — data is lost on restart by default  |
| **TTL Support** | Keys can automatically expire after N seconds  |
| **Use Cases**   | Caching, sessions, OTPs, rate limiting, queues |

---

## 2. Why Redis for OTP?

OTPs are **temporary by nature** — they should only live for a few minutes. Redis is perfect because:

- ⚡ **Fast** — reading/writing takes < 1ms
- ⏰ **Auto-expiry (TTL)** — Redis deletes the key automatically after a set time
- 🧹 **No cleanup needed** — you don't need a cron job to delete expired OTPs
- 💾 **No database overhead** — OTPs don't need to be stored permanently

---

## 3. Redis vs MySQL

| Feature              | Redis                      | MySQL                     |
| -------------------- | -------------------------- | ------------------------- |
| Storage              | RAM (in-memory)            | Disk                      |
| Speed                | Microseconds               | Milliseconds              |
| Data structure       | Key → Value                | Tables with rows/columns  |
| Auto-expiry          | ✅ Built-in TTL             | ❌ Needs manual cleanup    |
| Persistence          | Optional                   | Always                    |
| Best for OTP?        | ✅ Yes                      | ❌ Overkill                |
| Query language       | Simple commands (GET, SET) | SQL                       |

**Bottom line:** Use Redis for temporary, fast-access data. Use MySQL for permanent, relational data.

---

## 4. Prerequisites

| Requirement  | Version         | Check Command        |
| ------------ | --------------- | -------------------- |
| Node.js      | 18+             | `node -v`            |
| Python       | 3.8+            | `python --version`   |
| Docker       | Any recent      | `docker --version`   |
| pip          | Latest          | `pip --version`      |

---

## 5. How to Start Redis

### Using Docker (Recommended)

```bash
# Pull and run Redis in a Docker container
docker run -d --name redis-otp -p 6379:6379 redis
```

**What this does:**
- `-d` → Runs in the background (detached mode)
- `--name redis-otp` → Names the container "redis-otp"
- `-p 6379:6379` → Maps container port 6379 to your local port 6379
- `redis` → Uses the official Redis image

### Verify Redis is running

```bash
docker ps
```

You should see a container named `redis-otp` in the list.

### Stop Redis

```bash
docker stop redis-otp
```

### Start it again later

```bash
docker start redis-otp
```

---

## 6. How to Start the Backend (Flask)

```bash
# Navigate to the backend directory
cd backend

# Create a Python virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```

The Flask server will start on **http://localhost:5000**.

You should see:

```
✅  Redis connection successful!
   Host : localhost
   Port : 6379
   DB   : 0

🚀  Starting Flask server on http://localhost:5000
```

---

## 7. How to Start the Frontend (React)

```bash
# Navigate to the frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Start the Vite development server
npm run dev
```

The React app will start on **http://localhost:5173**.

---

## 8. API Documentation

### POST `/api/send-otp`

Generates a 6-digit OTP and stores it in Redis.

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "message": "OTP generated successfully.",
  "otp": "482913",
  "expires_in": 300,
  "redis_key": "otp:user@example.com"
}
```

**Redis operation:** `SETEX otp:user@example.com 300 482913`

---

### POST `/api/verify-otp`

Verifies the OTP entered by the user.

**Request:**

```json
{
  "email": "user@example.com",
  "otp": "482913"
}
```

**Success Response (200):**

```json
{
  "message": "OTP verified successfully!",
  "redis_operation": "DELETE — key removed after successful verification"
}
```

**Expired OTP Response (410):**

```json
{
  "error": "OTP has expired or does not exist. Please request a new OTP."
}
```

**Wrong OTP Response (400):**

```json
{
  "error": "Incorrect OTP. Please try again."
}
```

---

### GET `/api/otp-status?email=user@example.com`

Shows the current Redis state for an OTP key (educational endpoint).

**Response when OTP exists:**

```json
{
  "exists": true,
  "ttl": 247,
  "redis_key": "otp:user@example.com"
}
```

**Response when OTP doesn't exist:**

```json
{
  "exists": false,
  "ttl": -2,
  "redis_key": "otp:user@example.com"
}
```

---

### GET `/api/health`

Health check for the API and Redis.

```json
{
  "status": "healthy",
  "redis": "connected"
}
```

---

## 9. Redis Commands Explained

Here's every Redis command used in this project, explained with the OTP example:

### SETEX — Set with Expiry

```
SETEX otp:user@example.com 300 482913
```

| Part                       | Meaning                             |
| -------------------------- | ----------------------------------- |
| `SETEX`                    | SET a key with an EXpiry            |
| `otp:user@example.com`    | The key (we prefix with `otp:`)     |
| `300`                      | Expires in 300 seconds (5 minutes)  |
| `482913`                   | The value (our 6-digit OTP)         |

**Python equivalent:**

```python
redis_client.setex("otp:user@example.com", 300, "482913")
```

---

### GET — Retrieve a Value

```
GET otp:user@example.com
```

Returns: `"482913"` (or `nil` if expired/deleted)

**Python equivalent:**

```python
value = redis_client.get("otp:user@example.com")
# value = "482913" or None
```

---

### DEL — Delete a Key

```
DEL otp:user@example.com
```

Immediately removes the key from Redis.

**Python equivalent:**

```python
redis_client.delete("otp:user@example.com")
```

---

### EXISTS — Check If a Key Exists

```
EXISTS otp:user@example.com
```

Returns: `1` (exists) or `0` (doesn't exist)

**Python equivalent:**

```python
exists = redis_client.exists("otp:user@example.com")
# exists = True or False
```

---

### TTL — Get Time-To-Live

```
TTL otp:user@example.com
```

Returns the number of seconds remaining before the key expires.

**Python equivalent:**

```python
ttl = redis_client.ttl("otp:user@example.com")
```

---

## 10. TTL Explained

TTL (Time-To-Live) is one of Redis's most powerful features. It tells Redis: *"automatically delete this key after N seconds."*

### TTL Return Values

| Value  | Meaning                                      |
| ------ | -------------------------------------------- |
| `> 0`  | Key exists, will expire in this many seconds |
| `-1`   | Key exists but has **no** expiration set      |
| `-2`   | Key **does not exist**                         |

### Example Timeline

```
Time 0:00  → SETEX otp:user@example.com 300 482913
               TTL = 300

Time 1:00  → TTL otp:user@example.com
               TTL = 240  (60 seconds passed)

Time 4:00  → TTL otp:user@example.com
               TTL = 60   (only 1 minute left)

Time 5:00  → TTL otp:user@example.com
               TTL = -2   (key auto-deleted by Redis!)
```

---

## 11. What Happens When OTP Expires?

1. Redis **automatically deletes** the key when TTL reaches 0.
2. `GET otp:user@example.com` returns `nil` (Python returns `None`).
3. `EXISTS otp:user@example.com` returns `0`.
4. `TTL otp:user@example.com` returns `-2`.
5. The Flask API returns a **410 Gone** error.
6. The React frontend shows **"OTP expired. Please request a new OTP."**

You don't need a cron job, background task, or scheduled cleanup — **Redis handles it automatically**.

---

## 12. What Happens When OTP Is Verified?

1. User enters the OTP in the frontend.
2. Flask calls `GET otp:user@example.com` to retrieve the stored OTP.
3. If it matches, Flask calls `DELETE otp:user@example.com` to remove the key.
4. The OTP **cannot be reused** because it no longer exists in Redis.
5. `EXISTS otp:user@example.com` now returns `0`.

---

## 13. Inspecting Redis with Redis CLI

You can open a Redis command-line interface to manually inspect what your Flask app is storing.

### Open Redis CLI

```bash
docker exec -it redis-otp redis-cli
```

### Useful Commands

```bash
# List ALL keys in Redis
KEYS *

# Get the OTP value
GET otp:user@example.com
# → "482913"

# Check remaining time-to-live
TTL otp:user@example.com
# → 247

# Check if the key exists
EXISTS otp:user@example.com
# → (integer) 1

# Manually delete a key
DEL otp:user@example.com
# → (integer) 1

# Verify it's gone
GET otp:user@example.com
# → (nil)

# Exit Redis CLI
EXIT
```

This is the best way to **prove to yourself** that Flask is actually reading and writing to Redis.

---

## 14. Common Redis Errors

### `redis.exceptions.ConnectionError`

**Cause:** Redis server is not running.

**Fix:**

```bash
# Start Redis with Docker
docker run -d --name redis-otp -p 6379:6379 redis

# Or restart if the container exists
docker start redis-otp
```

### `Connection refused on port 6379`

**Cause:** Redis isn't listening on the expected port.

**Fix:** Check your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### `WRONGTYPE Operation against a key holding the wrong kind of value`

**Cause:** You're using the wrong Redis command for the key's data type.

**Fix:** In this project, we only use simple string values. Make sure you're using `GET`/`SET`, not list or hash commands.

---

## 15. What I Learned

By building this project, you've learned:

- ✅ **How to connect** a Python app to Redis
- ✅ **How to store** temporary data with `SETEX`
- ✅ **How to retrieve** data with `GET`
- ✅ **How to delete** data with `DELETE`
- ✅ **How to check** if data exists with `EXISTS`
- ✅ **How TTL works** — automatic key expiration
- ✅ **Why Redis is ideal** for temporary data like OTPs
- ✅ **Redis vs MySQL** — when to use each
- ✅ **Environment variables** — don't hardcode credentials
- ✅ **Full-stack flow** — React → Flask → Redis

---

## 🧑‍💻 Tech Stack

| Layer    | Technology           |
| -------- | -------------------- |
| Frontend | React, Vite, Axios   |
| Backend  | Flask, Flask-CORS    |
| Storage  | Redis                |
| DevOps   | Docker (for Redis)   |

---

## ⚠️ Development Note

This is an **educational project**. In production:

- Never return the OTP in the API response
- Send the OTP via email or SMS
- Add rate limiting
- Use HTTPS
- Add proper authentication

---

*Built for learning. Happy coding! 🚀*
