#!/bin/bash
set -e

# ── Bootstrap OpenClaw config ──────────────────────────────────────────────

OPENCLAW_HOME="${OPENCLAW_CONFIG_DIR:-/home/node/.openclaw}"
WORKSPACE="$OPENCLAW_HOME/workspace"
mkdir -p "$WORKSPACE"

# Write openclaw.json with Kimi/Moonshot as the LLM provider
cat > "$OPENCLAW_HOME/openclaw.json" <<JSONEOF
{
  "env": {
    "MOONSHOT_API_KEY": "${LLM_API_KEY}"
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "moonshot/kimi-k2.5"
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "moonshot": {
        "baseUrl": "https://api.moonshot.ai/v1",
        "apiKey": "\${MOONSHOT_API_KEY}",
        "api": "openai-completions",
        "models": [
          {
            "id": "kimi-k2.5",
            "name": "Kimi K2.5",
            "reasoning": false,
            "input": ["text", "image"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 262144,
            "maxTokens": 262144
          }
        ]
      }
    }
  }
}
JSONEOF

# Write SOUL.md based on the agent role
cat > "$WORKSPACE/SOUL.md" <<SOULEOF
# ${AGENT_ROLE:-Agent}

You are an AI employee working on the OpenClaw platform.
Your role: **${AGENT_ROLE:-general assistant}**
Your agent ID: ${AGENT_ID:-unknown}
Your user ID: ${USER_ID:-unknown}

## Behavior
- Execute tasks given to you by the platform promptly and thoroughly.
- Always respond with structured, actionable output.
- Stay within the boundaries of your role.
- When a task is complete, provide a clear summary of what was done.

## Communication
- Be professional and concise.
- If a task is unclear, state what assumptions you made.
- Never fabricate information.
SOULEOF

# Write AGENTS.md with role-specific instructions
cat > "$WORKSPACE/AGENTS.md" <<AGENTSEOF
# Operating Instructions

## Task Handling
You receive tasks from the platform via the task dispatch system.
Each task contains an instruction and optional metadata.
Execute the instruction, then return a clear result.

## Platform Gateway
The platform gateway is available at: ${PLATFORM_GATEWAY_URL:-http://host.docker.internal:8000/gateway}
Use it to send emails, Slack messages, or Discord messages on behalf of your user.
Always include your agent token in requests: Bearer ${AGENT_TOKEN:-none}
AGENTSEOF

# ── Start services ─────────────────────────────────────────────────────────

echo "[entrypoint] OpenClaw config written to $OPENCLAW_HOME"
echo "[entrypoint] Role: ${AGENT_ROLE:-generic}"
echo "[entrypoint] Starting OpenClaw gateway in background..."

# Start OpenClaw gateway in background
cd /app
node build/src/index.js &
OPENCLAW_PID=$!

# Wait for OpenClaw gateway to be ready
echo "[entrypoint] Waiting for OpenClaw gateway..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:18789/health > /dev/null 2>&1; then
        echo "[entrypoint] OpenClaw gateway ready"
        break
    fi
    sleep 1
done

# Start our task server
echo "[entrypoint] Starting task server on port 8080..."
cd /agent
exec python3 -m uvicorn server:app --host 0.0.0.0 --port 8080
