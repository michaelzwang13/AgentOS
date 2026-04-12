---
name: send_email
description: Send an email on behalf of the user via their connected Gmail account.
metadata:
  { "openclaw": { "requires": { "bins": ["curl"] } } }
---

# Send Email

Use this skill when you need to send an email on behalf of the user.

## How to use

Run the following command using the `exec` tool, replacing the placeholders:

```
exec curl -s -X POST "${PLATFORM_GATEWAY_URL}/email/send" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${USER_API_KEY}" \
  -d '{"to": "RECIPIENT_EMAIL", "subject": "EMAIL_SUBJECT", "body": "EMAIL_BODY"}'
```

## Parameters
- `RECIPIENT_EMAIL`: The email address to send to
- `EMAIL_SUBJECT`: The subject line
- `EMAIL_BODY`: The email body text

## Important
- Only send emails when explicitly asked to by the user or as part of your assigned task.
- Always confirm the recipient and content before sending.
- Keep emails professional and concise.
- If the response contains an error about missing credentials, inform the user they need to connect their Gmail account first.
