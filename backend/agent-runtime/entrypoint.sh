#!/bin/bash
set -e

# ── Bootstrap OpenClaw config ──────────────────────────────────────────────

OPENCLAW_HOME="${OPENCLAW_CONFIG_DIR:-/root/.openclaw}"
WORKSPACE="$OPENCLAW_HOME/workspace"
export WORKSPACE
mkdir -p "$WORKSPACE"

# Write openclaw.json with Kimi/Moonshot as the LLM provider
# Enable the OpenAI-compatible chat completions HTTP endpoint
# and set auth to none (internal container traffic only)
cat > "$OPENCLAW_HOME/openclaw.json" <<JSONEOF
{
  "env": {
    "MOONSHOT_API_KEY": "${LLM_API_KEY}"
  },
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN:-openclaw-internal}"
    },
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
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

# ── Write SOUL.md + install skills from the role template ──────────────────
# The orchestrator passes the resolved role template as base64-encoded JSON in
# AGENT_TEMPLATE_B64. The template's `system_prompt` becomes SOUL.md and its
# `skills` list selects which skills are installed (fallback: all skills).

python3 - <<'PYEOF'
import base64, json, os, pathlib, shutil

workspace = pathlib.Path(os.environ["WORKSPACE"])
role = os.environ.get("AGENT_ROLE", "Agent")
agent_id = os.environ.get("AGENT_ID", "unknown")
user_id = os.environ.get("USER_ID", "unknown")

template = {}
b64 = os.environ.get("AGENT_TEMPLATE_B64", "")
if b64:
    try:
        template = json.loads(base64.b64decode(b64))
    except Exception as e:
        print(f"[entrypoint] WARNING: could not decode AGENT_TEMPLATE_B64: {e}")

system_prompt = (template.get("system_prompt") or "").strip()
display_name = template.get("display_name") or role

if system_prompt:
    soul = (
        f"# {display_name}\n\n"
        f"{system_prompt}\n\n"
        "---\n"
        f"Agent ID: {agent_id}\n"
        f"User ID: {user_id}\n"
    )
    print("[entrypoint] SOUL.md written from template system_prompt")
else:
    soul = (
        f"# {role}\n\n"
        "You are an AI employee working on the OpenClaw platform.\n"
        f"Your role: **{role}**\n"
        f"Your agent ID: {agent_id}\n"
        f"Your user ID: {user_id}\n\n"
        "## Behavior\n"
        "- Execute tasks given to you by the platform promptly and thoroughly.\n"
        "- Always respond with structured, actionable output.\n"
        "- Stay within the boundaries of your role.\n"
        "- When a task is complete, provide a clear summary of what was done.\n"
    )
    print("[entrypoint] SOUL.md written from generic fallback (no template prompt)")

(workspace / "SOUL.md").write_text(soul)

# Install skills — only those named in the template, or all if none listed.
src = pathlib.Path("/agent/skills")
dst = workspace / "skills"
dst.mkdir(parents=True, exist_ok=True)
if src.is_dir():
    available = sorted(p.name for p in src.iterdir() if p.is_dir())
    requested = template.get("skills") or []
    selected = requested if requested else available
    installed = []
    for name in selected:
        skill_src = src / name
        if skill_src.is_dir():
            shutil.copytree(skill_src, dst / name, dirs_exist_ok=True)
            installed.append(name)
        else:
            print(f"[entrypoint] WARNING: skill '{name}' named in template but not in image")
    print(f"[entrypoint] Skills installed: {', '.join(installed) or '(none)'}")
PYEOF

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

# Start OpenClaw gateway in background (official entrypoint)
cd /app
node openclaw.mjs gateway --allow-unconfigured &
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
