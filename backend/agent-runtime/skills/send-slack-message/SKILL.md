---
name: send_slack_message
description: Send a message to a Slack channel on behalf of the user.
metadata:
  { "openclaw": { "requires": { "bins": ["curl"] } } }
---

# Send Slack Message

Use this skill when you need to send a message to a Slack channel.

## How to use

Run the following command using the `exec` tool, replacing the placeholders:

```
exec curl -s -X POST "${PLATFORM_GATEWAY_URL}/slack/message" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${USER_API_KEY}" \
  -d '{"channel": "CHANNEL_NAME_OR_ID", "text": "MESSAGE_TEXT"}'
```

## Parameters
- `CHANNEL_NAME_OR_ID`: The Slack channel name (e.g., `#general`) or channel ID
- `MESSAGE_TEXT`: The message to send

## Important
- Only send messages when explicitly asked to or as part of your assigned task.
- Keep messages concise and relevant to the channel topic.
- If the response contains an error about missing credentials, inform the user they need to connect their Slack workspace first.
