"""Test the platform health endpoint."""

from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import os


class TestHealth:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
