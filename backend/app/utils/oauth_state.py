"""Signed, expiring OAuth `state` tokens.

The OAuth `state` parameter round-trips through the third-party provider
(Slack/Google/GitHub) and lands in their logs and redirect chains, so it must
never carry a real credential. These tokens are HMAC-signed and time-limited:
they identify the user on callback and double as CSRF protection, but reveal
nothing and can't be forged without the server secret.
"""

import base64
import hashlib
import hmac
import time

from app.config import get_settings

# A state token is only valid for the few seconds it takes to complete consent.
_TTL_SECONDS = 600


def _secret() -> bytes:
    # Reuse the platform encryption key as the HMAC secret — it's already a
    # high-entropy server-only value, and OAuth state never leaves with it.
    return get_settings().encryption_key.encode()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(body: str) -> str:
    return _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())


def issue_state(user_id: str) -> str:
    """Return a signed state token binding this OAuth flow to `user_id`."""
    body = _b64(f"{user_id}:{int(time.time())}".encode())
    return f"{body}.{_sign(body)}"


def verify_state(state: str | None) -> str | None:
    """Return the user id if `state` is a valid, unexpired token, else None."""
    if not state or "." not in state:
        return None
    body, sig = state.rsplit(".", 1)
    if not hmac.compare_digest(sig, _sign(body)):
        return None
    try:
        user_id, issued_at = _unb64(body).decode().rsplit(":", 1)
        if int(issued_at) + _TTL_SECONDS < time.time():
            return None
        return user_id
    except (ValueError, UnicodeDecodeError):
        return None
