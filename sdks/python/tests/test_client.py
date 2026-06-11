"""Smoke tests for SuppuoClient."""
import pytest

from forjio_suppuo import SuppuoClient, SuppuoError


def test_construct():
    c = SuppuoClient(token="test")
    assert c is not None
    assert c.tickets is not None
    assert c.canned_replies is not None
    assert c.public is not None


def test_authed_call_without_token_raises(monkeypatch):
    monkeypatch.delenv("SUPPUO_TOKEN", raising=False)
    c = SuppuoClient()
    with pytest.raises(SuppuoError) as exc:
        c.canned_replies.list()
    assert exc.value.code == "AUTH_REQUIRED"
    assert exc.value.status == 0
