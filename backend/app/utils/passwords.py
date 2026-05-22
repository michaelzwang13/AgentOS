"""Password hashing for user accounts.

Uses bcrypt — a deliberately slow, salted KDF. Hashes are self-describing
(the salt and cost factor live inside the string), so no separate columns
are needed. bcrypt silently truncates input at 72 bytes; UserCreate caps
the password length so that truncation can never happen.
"""

import bcrypt


def hash_password(password: str) -> str:
    """Return a salted bcrypt hash safe to persist."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    """Constant-time check of a plaintext password against a stored hash."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed hash on the row — treat as a failed login, never crash.
        return False
