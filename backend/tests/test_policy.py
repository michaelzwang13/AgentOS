"""Tests for the action policy and agent authentication (Phase B).

Together these are the two halves of the trust moat: get_current_agent
resolves *who* is calling, require_action enforces *what* they may do.
"""

import pytest
from fastapi import HTTPException

from app.agent_auth import get_current_agent
from app.services.policy import require_action


class TestRequireAction:
    def test_allows_listed_action(self):
        """An action in the role template's allowed_actions passes."""
        agent = {"id": "a1", "role": "code-review-engineer"}
        require_action(agent, "github.review.submit")  # no exception

    def test_denies_unlisted_action(self):
        """Denied-by-default: merge is absent from allowed_actions."""
        agent = {"id": "a1", "role": "code-review-engineer"}
        with pytest.raises(HTTPException) as exc:
            require_action(agent, "github.pr.merge")
        assert exc.value.status_code == 403

    def test_denies_unknown_role(self):
        """An unloadable role grants nothing."""
        agent = {"id": "a1", "role": "nonexistent-role"}
        with pytest.raises(HTTPException) as exc:
            require_action(agent, "github.pr.read")
        assert exc.value.status_code == 403

    def test_denies_action_from_another_role(self):
        """A secretary may send email but cannot review PRs."""
        agent = {"id": "a1", "role": "secretary"}
        with pytest.raises(HTTPException) as exc:
            require_action(agent, "github.review.submit")
        assert exc.value.status_code == 403


class TestGetCurrentAgent:
    def test_missing_header_401(self):
        with pytest.raises(HTTPException) as exc:
            get_current_agent(None)
        assert exc.value.status_code == 401

    def test_malformed_header_401(self):
        """A non-Bearer scheme is rejected."""
        with pytest.raises(HTTPException) as exc:
            get_current_agent("Token at_abc")
        assert exc.value.status_code == 401

    def test_unknown_token_401(self, fake_supabase):
        fake_supabase.get_table("agents").set_select_result([])
        with pytest.raises(HTTPException) as exc:
            get_current_agent("Bearer at_unknown")
        assert exc.value.status_code == 401

    def test_valid_token_resolves_agent(self, fake_supabase):
        agent = {
            "id": "a1", "role": "code-review-engineer",
            "user_id": "u1", "agent_token": "at_good",
        }
        fake_supabase.get_table("agents").set_select_result([agent])
        result = get_current_agent("Bearer at_good")
        assert result["id"] == "a1"
        assert result["user_id"] == "u1"
