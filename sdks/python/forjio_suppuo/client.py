"""Suppuo client — mirrors ``@forjio/suppuo`` (JS) 1:1.

Auth = Bearer JWT (a Huudis-minted access token). Pass ``token=`` or set
``SUPPUO_TOKEN``. The ``public`` namespace (requester-facing hosted-form
endpoints) needs no token at all.

Every response rides the Forjio envelope ``{data, error, meta}``; the
client unwraps it and raises :class:`SuppuoError` (with the envelope's
``error.code``) on failure.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode

import httpx

from .errors import SuppuoError


def _qs(params: Optional[Dict[str, Any]]) -> str:
    if not params:
        return ""
    entries = [(k, v) for k, v in params.items() if v is not None]
    if not entries:
        return ""
    return "?" + urlencode([(k, str(v)) for k, v in entries])


def _enc(segment: str) -> str:
    return quote(segment, safe="")


class _Tickets:
    """Agent workspace surface (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def list(
        self,
        *,
        status: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """GET /api/v1/tickets — ``{"tickets": [...], "counts": {...}}``."""
        return self._c.request(
            "GET", "/api/v1/tickets" + _qs({"status": status, "limit": limit})
        )

    def get(self, id: str) -> Dict[str, Any]:
        """GET /api/v1/tickets/:id — full ticket incl. message thread."""
        return self._c.request("GET", f"/api/v1/tickets/{_enc(id)}")

    def create(
        self,
        *,
        subject: str,
        body: str,
        requester_email: str,
        requester_name: Optional[str] = None,
        priority: Optional[str] = None,
        channel: Optional[str] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/tickets — agent-logged ticket (e.g. arrived via WhatsApp)."""
        payload: Dict[str, Any] = {
            "subject": subject,
            "body": body,
            "requesterEmail": requester_email,
        }
        if requester_name is not None:
            payload["requesterName"] = requester_name
        if priority is not None:
            payload["priority"] = priority
        if channel is not None:
            payload["channel"] = channel
        return self._c.request("POST", "/api/v1/tickets", body=payload)

    def reply(
        self,
        id: str,
        *,
        body: str,
        is_internal: Optional[bool] = None,
        author_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/tickets/:id/messages — agent reply (or internal note)."""
        payload: Dict[str, Any] = {"body": body}
        if is_internal is not None:
            payload["isInternal"] = is_internal
        if author_name is not None:
            payload["authorName"] = author_name
        return self._c.request("POST", f"/api/v1/tickets/{_enc(id)}/messages", body=payload)

    def update(
        self,
        id: str,
        *,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_sub: Optional[str] = ...,  # type: ignore[assignment]
    ) -> Dict[str, Any]:
        """PATCH /api/v1/tickets/:id — status / priority / assignee.

        Pass ``assignee_sub=None`` explicitly to unassign.
        """
        payload: Dict[str, Any] = {}
        if status is not None:
            payload["status"] = status
        if priority is not None:
            payload["priority"] = priority
        if assignee_sub is not ...:
            payload["assigneeSub"] = assignee_sub
        return self._c.request("PATCH", f"/api/v1/tickets/{_enc(id)}", body=payload)


class _CannedReplies:
    """Per-workspace saved reply snippets (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def list(self) -> Dict[str, Any]:
        """GET /api/v1/canned-replies — ``{"cannedReplies": [...]}``."""
        return self._c.request("GET", "/api/v1/canned-replies")

    def create(self, *, title: str, body: str) -> Dict[str, Any]:
        """POST /api/v1/canned-replies."""
        return self._c.request(
            "POST", "/api/v1/canned-replies", body={"title": title, "body": body}
        )

    def update(
        self,
        id: str,
        *,
        title: Optional[str] = None,
        body: Optional[str] = None,
    ) -> Dict[str, Any]:
        """PATCH /api/v1/canned-replies/:id."""
        payload: Dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if body is not None:
            payload["body"] = body
        return self._c.request("PATCH", f"/api/v1/canned-replies/{_enc(id)}", body=payload)

    def delete(self, id: str) -> Dict[str, Any]:
        """DELETE /api/v1/canned-replies/:id — ``{"deleted": true}``."""
        return self._c.request("DELETE", f"/api/v1/canned-replies/{_enc(id)}")


class _Public:
    """Requester-facing, unauthenticated surface."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def submit_ticket(
        self,
        *,
        account_id: str,
        subject: str,
        body: str,
        email: str,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/public/tickets — ``{"number", "accessToken"}``.

        The returned ``accessToken`` is the requester's only credential.
        """
        payload: Dict[str, Any] = {
            "accountId": account_id,
            "subject": subject,
            "body": body,
            "email": email,
        }
        if name is not None:
            payload["name"] = name
        return self._c.request("POST", "/api/v1/public/tickets", body=payload, no_auth=True)

    def get_ticket(self, access_token: str) -> Dict[str, Any]:
        """GET /api/v1/public/tickets/:accessToken — tokenized status view."""
        return self._c.request(
            "GET", f"/api/v1/public/tickets/{_enc(access_token)}", no_auth=True
        )

    def reply_ticket(self, access_token: str, *, body: str) -> Dict[str, Any]:
        """POST /api/v1/public/tickets/:accessToken/messages — requester reply."""
        return self._c.request(
            "POST",
            f"/api/v1/public/tickets/{_enc(access_token)}/messages",
            body={"body": body},
            no_auth=True,
        )


class SuppuoClient:
    """Suppuo typed client.

    Example:
        client = SuppuoClient(token=os.environ["SUPPUO_TOKEN"])
        page = client.tickets.list(status="open")
        client.tickets.reply(page["tickets"][0]["id"], body="On it!")
    """

    def __init__(
        self,
        *,
        token: Optional[str] = None,
        base_url: str = "https://suppuo.com",
        timeout: float = 30.0,
    ) -> None:
        self._token = token if token is not None else os.environ.get("SUPPUO_TOKEN")
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

        self.tickets = _Tickets(self)
        self.canned_replies = _CannedReplies(self)
        self.public = _Public(self)

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[Dict[str, Any]] = None,
        no_auth: bool = False,
    ) -> Any:
        headers = {"Accept": "application/json"}
        if not no_auth:
            if not self._token:
                raise SuppuoError(
                    0,
                    "AUTH_REQUIRED",
                    "No token configured. Pass token= or set SUPPUO_TOKEN.",
                )
            headers["Authorization"] = f"Bearer {self._token}"

        try:
            resp = httpx.request(
                method,
                self._base_url + path,
                json=body,
                headers=headers,
                timeout=self._timeout,
            )
        except httpx.TimeoutException as e:
            raise SuppuoError(0, "TIMEOUT", f"request timed out: {e}") from e
        except httpx.HTTPError as e:
            raise SuppuoError(0, "NETWORK_ERROR", str(e)) from e

        try:
            envelope = resp.json()
        except ValueError as e:
            raise SuppuoError(
                resp.status_code,
                "INVALID_RESPONSE",
                f"non-JSON response (HTTP {resp.status_code})",
            ) from e

        error = envelope.get("error") if isinstance(envelope, dict) else None
        meta = envelope.get("meta") if isinstance(envelope, dict) else None
        request_id = meta.get("requestId") if isinstance(meta, dict) else None

        if resp.status_code >= 400 or error:
            raise SuppuoError(
                resp.status_code,
                (error or {}).get("code", "UNKNOWN"),
                (error or {}).get("message", f"HTTP {resp.status_code}"),
                request_id,
                (error or {}).get("param"),
            )
        return envelope.get("data") if isinstance(envelope, dict) else envelope


__all__ = ["SuppuoClient", "SuppuoError"]
