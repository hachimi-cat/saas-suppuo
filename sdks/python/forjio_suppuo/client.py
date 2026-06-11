"""Suppuo client — mirrors ``@forjio/suppuo`` (JS) 1:1.

Auth = Bearer token — an ``sk_live_...`` API key from the dashboard (or
a Huudis-minted access token). Pass ``token=`` or set ``SUPPUO_TOKEN``.
The ``public`` namespace (requester-facing hosted-form endpoints) needs
no token at all.

Every response rides the Forjio envelope ``{data, error, meta}``; the
client unwraps it and raises :class:`SuppuoError` (with the envelope's
``error.code``) on failure.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote, unquote, urlencode

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
        assignee: Optional[str] = None,
        tag: Optional[str] = None,
        channel: Optional[str] = None,
        priority: Optional[str] = None,
        q: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        """GET /api/v1/tickets — ``{"tickets", "counts", "cursor", "hasMore"}``.

        Filters: ``status`` (open|pending|resolved|closed|all),
        ``assignee`` (a Huudis sub, ``"me"``, or ``"unassigned"``),
        ``tag`` (exact, lowercase), ``channel``
        (web|email|whatsapp|telegram), ``priority``, ``q`` (free-text
        search), ``limit`` (1-100), ``cursor`` (opaque, from the
        previous page).
        """
        return self._c.request(
            "GET",
            "/api/v1/tickets"
            + _qs(
                {
                    "status": status,
                    "assignee": assignee,
                    "tag": tag,
                    "channel": channel,
                    "priority": priority,
                    "q": q,
                    "limit": limit,
                    "cursor": cursor,
                }
            ),
        )

    def tags(self) -> Dict[str, Any]:
        """GET /api/v1/tickets/tags — ``{"tags": [...]}`` (distinct, sorted)."""
        return self._c.request("GET", "/api/v1/tickets/tags")

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
        attachment_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/tickets/:id/messages — agent reply (or internal note).

        Stage files first via :meth:`SuppuoClient.attachments.upload`
        and pass their ids as ``attachment_ids``.
        """
        payload: Dict[str, Any] = {"body": body}
        if is_internal is not None:
            payload["isInternal"] = is_internal
        if author_name is not None:
            payload["authorName"] = author_name
        if attachment_ids is not None:
            payload["attachmentIds"] = attachment_ids
        return self._c.request("POST", f"/api/v1/tickets/{_enc(id)}/messages", body=payload)

    def update(
        self,
        id: str,
        *,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_sub: Optional[str] = ...,  # type: ignore[assignment]
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """PATCH /api/v1/tickets/:id — status / priority / assignee / tags.

        Pass ``assignee_sub=None`` explicitly to unassign. ``tags``
        replaces the full tag list (normalized server-side: trimmed,
        lowercased, deduped; max 10 tags x 40 chars).
        """
        payload: Dict[str, Any] = {}
        if status is not None:
            payload["status"] = status
        if priority is not None:
            payload["priority"] = priority
        if assignee_sub is not ...:
            payload["assigneeSub"] = assignee_sub
        if tags is not None:
            payload["tags"] = tags
        return self._c.request("PATCH", f"/api/v1/tickets/{_enc(id)}", body=payload)


class _Billing:
    """Workspace plan + Plugipay checkout (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def get(self) -> Dict[str, Any]:
        """GET /api/v1/billing — ``{"subscription", "earlyAccess", "tiers"}``.

        ``tiers`` carries the full tier table (ids: ``free`` /
        ``starter`` / ``growth`` / ``business``) with ``name``,
        ``priceIdr``, ``blurb``, ``features``, ``agentLimit``,
        ``waNumberLimit``.
        """
        return self._c.request("GET", "/api/v1/billing")

    def checkout(self, tier: str) -> Dict[str, Any]:
        """POST /api/v1/billing/checkout — ``{"checkoutSessionId", "hostedUrl"}``.

        ``tier`` must be a paid tier id (``starter`` / ``growth`` /
        ``business``); redirect the browser to ``hostedUrl``.
        """
        return self._c.request("POST", "/api/v1/billing/checkout", body={"tier": tier})


class _Channels:
    """Per-workspace BYO channel integrations (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def list(self) -> Dict[str, Any]:
        """GET /api/v1/channels — ``{"integrations": [...], "platform": {...}}``.

        Credentials are never included in list responses.
        """
        return self._c.request("GET", "/api/v1/channels")

    def create(self, *, provider: str, **fields: Any) -> Dict[str, Any]:
        """POST /api/v1/channels — connect a provider.

        ``provider`` is one of ``whatsapp_twilio`` / ``whatsapp_cloud``
        / ``email_resend`` / ``telegram_bot`` / ``slack_webhook`` /
        ``discord_webhook``; the remaining keyword args are that
        provider's camelCase payload fields (e.g.
        ``botToken=...`` for ``telegram_bot``, ``accountSid=`` +
        ``authToken=`` + ``whatsappNumber=`` for ``whatsapp_twilio``).
        Credentials are validated live against the provider before the
        integration activates.
        """
        payload: Dict[str, Any] = {"provider": provider}
        payload.update({k: v for k, v in fields.items() if v is not None})
        return self._c.request("POST", "/api/v1/channels", body=payload)

    def delete(self, id: str) -> Dict[str, Any]:
        """DELETE /api/v1/channels/:id — ``{"deleted": true}``."""
        return self._c.request("DELETE", f"/api/v1/channels/{_enc(id)}")


class _Reports:
    """On-the-fly support analytics (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def summary(self, *, days: Optional[int] = None) -> Dict[str, Any]:
        """GET /api/v1/reports/summary?days= — the analytics summary.

        ``days`` is the window: 7, 30 (default), or 90.
        """
        return self._c.request("GET", "/api/v1/reports/summary" + _qs({"days": days}))


class _Settings:
    """Workspace settings (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def get_automation(self) -> Dict[str, Any]:
        """GET /api/v1/settings/automation — business hours +
        auto-response templates + ``hideBranding``."""
        return self._c.request("GET", "/api/v1/settings/automation")

    def put_automation(
        self,
        *,
        business_hours: Optional[Dict[str, Any]] = ...,  # type: ignore[assignment]
        auto_response_enabled: Optional[bool] = None,
        auto_response_inside: Optional[str] = ...,  # type: ignore[assignment]
        auto_response_outside: Optional[str] = ...,  # type: ignore[assignment]
        hide_branding: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """PUT /api/v1/settings/automation — partial update.

        Omitted fields are left alone; pass an explicit ``None`` (for
        the ``...``-defaulted params) to clear.
        """
        payload: Dict[str, Any] = {}
        if business_hours is not ...:
            payload["businessHours"] = business_hours
        if auto_response_enabled is not None:
            payload["autoResponseEnabled"] = auto_response_enabled
        if auto_response_inside is not ...:
            payload["autoResponseInside"] = auto_response_inside
        if auto_response_outside is not ...:
            payload["autoResponseOutside"] = auto_response_outside
        if hide_branding is not None:
            payload["hideBranding"] = hide_branding
        return self._c.request("PUT", "/api/v1/settings/automation", body=payload)


class _Csat:
    """Agent-side CSAT aggregates (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def stats(self) -> Dict[str, Any]:
        """GET /api/v1/csat/stats — ``{"average": 1..3 | None, "count"}``."""
        return self._c.request("GET", "/api/v1/csat/stats")


class _Attachments:
    """Ticket-message attachments — staging upload + download (Bearer auth)."""

    def __init__(self, c: "SuppuoClient") -> None:
        self._c = c

    def upload(self, *, data: bytes, filename: str, content_type: str) -> Dict[str, Any]:
        """POST /api/v1/attachments — stage an upload (8MB max).

        Returns the attachment metadata; bind the ``id`` to a reply via
        ``tickets.reply(..., attachment_ids=[meta["id"]])``.
        """
        return self._c.request(
            "POST",
            "/api/v1/attachments",
            raw_body=data,
            headers={"Content-Type": content_type, "X-Filename": quote(filename)},
        )

    def download(self, id: str) -> Dict[str, Any]:
        """GET /api/v1/attachments/:id — account-scoped download.

        Returns ``{"data": bytes, "contentType": str, "filename": str}``.
        """
        return self._c.download(f"/api/v1/attachments/{_enc(id)}", fallback_filename=id)


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
        self.billing = _Billing(self)
        self.channels = _Channels(self)
        self.reports = _Reports(self)
        self.settings = _Settings(self)
        self.csat = _Csat(self)
        self.attachments = _Attachments(self)
        self.public = _Public(self)

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[Dict[str, Any]] = None,
        no_auth: bool = False,
        raw_body: Optional[bytes] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        req_headers = {"Accept": "application/json"}
        if headers:
            req_headers.update(headers)
        if not no_auth:
            if not self._token:
                raise SuppuoError(
                    0,
                    "AUTH_REQUIRED",
                    "No token configured. Pass token= or set SUPPUO_TOKEN.",
                )
            req_headers["Authorization"] = f"Bearer {self._token}"

        try:
            resp = httpx.request(
                method,
                self._base_url + path,
                json=body if raw_body is None else None,
                content=raw_body,
                headers=req_headers,
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

    def download(self, path: str, *, fallback_filename: str = "") -> Dict[str, Any]:
        """GET a binary route (attachment download).

        Success returns ``{"data": bytes, "contentType", "filename"}``;
        error responses still ride the JSON envelope and raise
        :class:`SuppuoError`.
        """
        if not self._token:
            raise SuppuoError(
                0,
                "AUTH_REQUIRED",
                "No token configured. Pass token= or set SUPPUO_TOKEN.",
            )
        try:
            resp = httpx.get(
                self._base_url + path,
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=self._timeout,
            )
        except httpx.TimeoutException as e:
            raise SuppuoError(0, "TIMEOUT", f"request timed out: {e}") from e
        except httpx.HTTPError as e:
            raise SuppuoError(0, "NETWORK_ERROR", str(e)) from e

        if resp.status_code >= 400:
            try:
                envelope = resp.json()
            except ValueError:
                envelope = {}
            error = envelope.get("error") if isinstance(envelope, dict) else None
            meta = envelope.get("meta") if isinstance(envelope, dict) else None
            raise SuppuoError(
                resp.status_code,
                (error or {}).get("code", "UNKNOWN"),
                (error or {}).get("message", f"HTTP {resp.status_code}"),
                meta.get("requestId") if isinstance(meta, dict) else None,
                (error or {}).get("param"),
            )

        disposition = resp.headers.get("content-disposition", "")
        filename = fallback_filename
        star = re.search(r"filename\*=UTF-8''([^;]+)", disposition, re.IGNORECASE)
        plain = re.search(r'filename="([^"]*)"', disposition)
        if star:
            filename = unquote(star.group(1))
        elif plain:
            filename = plain.group(1)
        return {
            "data": resp.content,
            "contentType": resp.headers.get("content-type", "application/octet-stream"),
            "filename": filename,
        }


__all__ = ["SuppuoClient", "SuppuoError"]
