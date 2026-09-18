# TASK: Expose App Search API & Connect to Claude via FastMCP

## 🎯 Objective

Create a secure, token-protected search API endpoint on the current web application, configure Nginx and SSL reverse proxy rules on the VPS, and generate a local Model Context Protocol (FastMCP) server so Claude can query the application database during daily investigations.

---

## Phase 1: Create Search Endpoint & Environment Config

### Step 1.1: Set Environment Variable

1. Open `.env` (or `.env.local`).
2. Add a strong random internal API secret key:

   ```env
   INTERNAL_SEARCH_API_KEY="generate-a-secure-random-64-character-token-here"
