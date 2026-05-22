"""Password hashing for user accounts.

bcrypt is the KDF — deliberately slow and salted, with the salt and cost
factor stored inside the hash string. bcrypt has two input quirks: it
truncates at 72 bytes and stops at the first null byte. To sidestep both,
the password is SHA-256'd and base64-encoded first, yielding a fixed
44-byte, null-free input. Password length is therefore unbounded in
practice — a long or multi-byte-UTF-8 password can never be silently
truncated into a collision.
"""

import base64
import hashlib

import bcrypt


def _prehash(password: str) -> bytes:
    """SHA-256 then base64 — a fixed-size, null-free input safe for bcrypt."""
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)


def hash_password(password: str) -> str:
    """Return a salted bcrypt hash safe to persist."""
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    """Constant-time check of a plaintext password against a stored hash."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(_prehash(password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed hash on the row — treat as a failed login, never crash.
        return False
