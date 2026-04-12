"""Shared fixtures for the OpenClaw test suite.

Mocks external dependencies (Supabase, Docker) so tests run without
any infrastructure.
"""

import os
import pytest
from unittest.mock import MagicMock, patch, call
from cryptography.fernet import Fernet

# Generate a deterministic encryption key for tests
_TEST_FERNET_KEY = Fernet.generate_key().decode()

# Set env vars BEFORE any app imports so Settings picks them up
os.environ.update(
    {
        "SUPABASE_URL": "https://fake.supabase.co",
        "SUPABASE_KEY": "fake-key",
        "ENCRYPTION_KEY": _TEST_FERNET_KEY,
        "DOCKER_NETWORK": "openclaw-agents",
        "OPENCLAW_AGENT_IMAGE": "openclaw/agent:latest",
        "LLM_API_KEY": "test-llm-key",
        "PLATFORM_GATEWAY_URL": "http://host.docker.internal:8000/gateway",
    }
)

from fastapi.testclient import TestClient
from app.main import app
from app.config import get_settings


# ── Table-aware Supabase mock ───────────────────────────────────────────────


class TableMock:
    """A mock for a single Supabase table with chainable methods."""

    def __init__(self):
        self._mock = MagicMock()

    @property
    def mock(self):
        return self._mock

    def set_select_result(self, data, filters=None):
        """Configure select().eq().execute() to return data."""
        chain = self._mock.select.return_value
        if filters:
            for _ in filters:
                chain = chain.eq.return_value
        else:
            chain = chain.eq.return_value
        chain.execute.return_value = MagicMock(data=data)

    def set_select_double_filter(self, data):
        """Configure select().eq().eq().execute()."""
        self._mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=data)

    def set_select_order(self, data):
        """Configure select().eq().order().execute()."""
        self._mock.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=data)

    def set_select_range(self, data):
        """Configure select().range().execute()."""
        self._mock.select.return_value.range.return_value.execute.return_value = MagicMock(data=data)

    def set_insert_result(self, data):
        self._mock.insert.return_value.execute.return_value = MagicMock(data=data)

    def set_upsert_result(self, data):
        self._mock.upsert.return_value.execute.return_value = MagicMock(data=data)

    def set_update_result(self, data):
        self._mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=data)

    def set_delete_result(self, data):
        self._mock.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=data)

    def set_delete_double_filter(self, data):
        self._mock.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=data)


class SupabaseMock:
    """A mock Supabase client that returns different mocks per table name."""

    def __init__(self):
        self._tables: dict[str, TableMock] = {}
        self._mock = MagicMock()
        self._mock.table.side_effect = self._get_table

    def _get_table(self, name: str):
        if name not in self._tables:
            self._tables[name] = TableMock()
        return self._tables[name].mock

    def get_table(self, name: str) -> TableMock:
        if name not in self._tables:
            self._tables[name] = TableMock()
        return self._tables[name]

    @property
    def client(self):
        return self._mock


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture()
def fake_supabase():
    """Patch the global Supabase client with a table-aware mock."""
    sb = SupabaseMock()
    with patch("app.database._client", sb.client), patch(
        "app.database.get_supabase", return_value=sb.client
    ):
        yield sb


@pytest.fixture()
def client(fake_supabase):
    """TestClient with Supabase already mocked."""
    return TestClient(app)


@pytest.fixture()
def authed_client(fake_supabase):
    """TestClient whose requests include a valid X-Api-Key header.

    Configures the users table so auth lookup returns a user.
    Returns (client, user, fake_supabase).
    """
    user = _make_user()
    fake_supabase.get_table("users").set_select_result([user])
    c = TestClient(app)
    c.headers["X-Api-Key"] = "test-api-key"
    return c, user, fake_supabase


@pytest.fixture()
def mock_docker():
    """Patch docker.from_env() with a controllable mock."""
    mock_client = MagicMock()
    mock_network = MagicMock()
    mock_client.networks.get.return_value = mock_network
    with patch("docker.from_env", return_value=mock_client):
        yield mock_client


# ── Helpers ─────────────────────────────────────────────────────────────────


def _make_user(**overrides):
    base = {
        "id": "user-001",
        "email": "test@example.com",
        "name": "Test User",
        "api_key": "test-api-key",
        "created_at": "2025-01-01T00:00:00+00:00",
    }
    base.update(overrides)
    return base


def _make_agent(**overrides):
    base = {
        "id": "agent-001",
        "user_id": "user-001",
        "role": "secretary",
        "container_id": "container-abc",
        "status": "running",
        "config_json": {},
        "created_at": "2025-01-01T00:00:00+00:00",
    }
    base.update(overrides)
    return base
