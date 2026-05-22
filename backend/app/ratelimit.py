"""Shared rate limiter.

A single Limiter instance so routers and the app register the same object.
Disabled when RATE_LIMIT_ENABLED=false (used by the test suite) so limits
never make tests flaky.
"""

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    enabled=os.getenv("RATE_LIMIT_ENABLED", "true").lower() != "false",
)
