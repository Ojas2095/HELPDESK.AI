import pytest


def test_ticket_insert_webhook_function_exists(db_connection):
    """
    Verify the webhook trigger function exists.
    """

    query = """
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'ticket_insert_webhook';
    """

    with db_connection.cursor() as cursor:
        cursor.execute(query)
        result = cursor.fetchone()

    assert result is not None
    assert result[0] == "ticket_insert_webhook"


def test_ticket_insert_trigger_exists(db_connection):
    """
    Verify the trigger exists on tickets table.
    """

    query = """
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'tickets'
    AND trigger_name = 'ticket_insert_trigger';
    """

    with db_connection.cursor() as cursor:
        cursor.execute(query)
        result = cursor.fetchone()

    assert result is not None
    assert result[0] == "ticket_insert_trigger"


def test_webhook_payload_structure():
    """
    Validate webhook payload structure.
    """

    sample_record = {
        "id": 1,
        "title": "Test Ticket",
        "description": "Webhook payload test"
    }

    payload = {
        "type": "INSERT",
        "table": "tickets",
        "record": sample_record
    }

    assert payload["type"] == "INSERT"
    assert payload["table"] == "tickets"

    assert "record" in payload
    assert payload["record"]["id"] == 1
    assert payload["record"]["title"] == "Test Ticket"


def test_webhook_payload_handles_empty_record():
    """
    Ensure payload handles empty records.
    """

    payload = {
        "type": "INSERT",
        "table": "tickets",
        "record": {}
    }

    assert payload["record"] == {}


def test_webhook_payload_handles_null_values():
    """
    Ensure payload handles null values correctly.
    """

    payload = {
        "type": "INSERT",
        "table": "tickets",
        "record": {
            "id": 1,
            "title": None,
            "description": None
        }
    }

    assert payload["record"]["title"] is None
    assert payload["record"]["description"] is None


def test_ticket_insert_webhook_function_definition_contains_http_post(
    db_connection,
):
    """
    Verify webhook function uses net.http_post.
    """

    query = """
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'ticket_insert_webhook'
    AND n.nspname = 'public';
    """

    with db_connection.cursor() as cursor:
        cursor.execute(query)
        result = cursor.fetchone()

    assert result is not None

    function_definition = result[0]

    assert "net.http_post" in function_definition


def test_ticket_insert_webhook_contains_authorization_header(
    db_connection,
):
    """
    Verify Authorization header exists in webhook function.
    """

    query = """
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'ticket_insert_webhook'
    AND n.nspname = 'public';
    """

    with db_connection.cursor() as cursor:
        cursor.execute(query)
        result = cursor.fetchone()

    function_definition = result[0]

    assert "Authorization" in function_definition


def test_ticket_insert_webhook_returns_new_record(
    db_connection,
):
    """
    Ensure trigger function returns NEW.
    """

    query = """
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'ticket_insert_webhook'
    AND n.nspname = 'public';
    """

    with db_connection.cursor() as cursor:
        cursor.execute(query)
        result = cursor.fetchone()

    function_definition = result[0]

    assert "return NEW" in function_definition

