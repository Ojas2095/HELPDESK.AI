"""Unit tests for redis_cache service."""

import hashlib
import json
import pytest
from unittest.mock import MagicMock, patch


class TestTruthy:
    """Tests for _truthy helper."""

    def test_truthy_strings(self):
        from services.redis_cache import _truthy
        assert _truthy("1") is True
        assert _truthy("true") is True
        assert _truthy("yes") is True
        assert _truthy("on") is True

    def test_falsy_strings(self):
        from services.redis_cache import _truthy
        assert _truthy("0") is False
        assert _truthy("false") is False
        assert _truthy("no") is False
        assert _truthy("off") is False
        assert _truthy("") is False
        assert _truthy(None) is False

    def test_whitespace_handling(self):
        from services.redis_cache import _truthy
        assert _truthy("  1  ") is True
        assert _truthy("  false  ") is False


class TestTextKey:
    """Tests for _text_key helper."""

    def test_md5_hash_consistency(self):
        from services.redis_cache import _text_key
        key1 = _text_key("helpdesk:cls:", "Hello World")
        key2 = _text_key("helpdesk:cls:", "Hello World")
        assert key1 == key2

    def test_case_insensitive(self):
        from services.redis_cache import _text_key
        key1 = _text_key("helpdesk:cls:", "Hello")
        key2 = _text_key("helpdesk:cls:", "hello")
        assert key1 == key2

    def test_whitespace_not_trimmed(self):
        """The function normalizes internal whitespace but does not trim ends."""
        from services.redis_cache import _text_key
        key1 = _text_key("helpdesk:cls:", "Hello World")
        key2 = _text_key("helpdesk:cls:", "  Hello   World  ")
        # Internal spaces normalized to hyphens, but ends not trimmed
        assert key1 != key2  # different because leading space differs after normalization

    def test_empty_text_returns_none(self):
        from services.redis_cache import _text_key
        assert _text_key("helpdesk:cls:", "") is None
        assert _text_key("helpdesk:cls:", "   ") is None

    def test_none_text_returns_none(self):
        from services.redis_cache import _text_key
        result = _text_key("helpdesk:cls:", None)  # type: ignore
        assert result is None

    def test_prefix_in_key(self):
        from services.redis_cache import _text_key
        key = _text_key("helpdesk:cls:", "test")
        assert key.startswith("helpdesk:cls:")

    def test_different_texts_different_keys(self):
        from services.redis_cache import _text_key
        key1 = _text_key("helpdesk:cls:", "Hello")
        key2 = _text_key("helpdesk:cls:", "World")
        assert key1 != key2


class TestRedisInferenceCache:
    """Tests for RedisInferenceCache class."""

    def test_init_defaults(self):
        with patch.dict("os.environ", {}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            assert cache.enabled is False
            assert cache.allow_degraded is False
            assert cache.ttl_seconds == 3600

    def test_init_with_env_vars(self):
        with patch.dict("os.environ", {
            "USE_REDIS_CACHE": "true",
            "ALLOW_DEGRADED_STARTUP": "yes",
            "REDIS_CACHE_TTL_SECONDS": "7200",
        }, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            assert cache.enabled is True
            assert cache.allow_degraded is True
            assert cache.ttl_seconds == 7200

    def test_init_various_truthy_values(self):
        for val in ["1", "true", "yes", "on"]:
            with patch.dict("os.environ", {"USE_REDIS_CACHE": val}, clear=True):
                from services.redis_cache import RedisInferenceCache
                cache = RedisInferenceCache()
                assert cache.enabled is True

    def test_init_various_falsy_values(self):
        for val in ["0", "false", "no", "off", ""]:
            with patch.dict("os.environ", {"USE_REDIS_CACHE": val}, clear=True):
                from services.redis_cache import RedisInferenceCache
                cache = RedisInferenceCache()
                assert cache.enabled is False

    def test_available_property_disabled(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "false"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            assert cache.available is False

    def test_available_property_no_client(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            assert cache.available is False

    def test_available_property_with_client(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            cache._client = mock_client
            assert cache.available is True

    def test_connect_disabled(self, caplog):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "false"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            import logging
            caplog.set_level(logging.INFO)
            cache = RedisInferenceCache()
            cache.connect()
            assert "Disabled" in caplog.text
            assert cache._client is None

    def test_connect_success(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            mock_redis_module = MagicMock()
            mock_client = MagicMock()
            mock_redis_module.from_url.return_value = mock_client
            with patch.dict("sys.modules", {"redis": mock_redis_module}):
                from services.redis_cache import RedisInferenceCache
                cache = RedisInferenceCache()
                cache.connect()
                assert cache._client is not None

    def test_connect_failure_allow_degraded(self, caplog):
        with patch.dict("os.environ", {
            "USE_REDIS_CACHE": "true",
            "ALLOW_DEGRADED_STARTUP": "yes",
        }, clear=True):
            mock_redis_module = MagicMock()
            mock_redis_module.from_url.side_effect = Exception("Connection refused")
            with patch.dict("sys.modules", {"redis": mock_redis_module}):
                from services.redis_cache import RedisInferenceCache
                import logging
                caplog.set_level(logging.WARNING)
                cache = RedisInferenceCache()
                cache.connect()
                assert cache._client is None
                assert "Unavailable" in caplog.text

    def test_connect_failure_no_degraded(self):
        with patch.dict("os.environ", {
            "USE_REDIS_CACHE": "true",
            "ALLOW_DEGRADED_STARTUP": "no",
        }, clear=True):
            mock_redis_module = MagicMock()
            mock_redis_module.from_url.side_effect = Exception("Connection refused")
            with patch.dict("sys.modules", {"redis": mock_redis_module}):
                from services.redis_cache import RedisInferenceCache
                cache = RedisInferenceCache()
                with pytest.raises(RuntimeError, match="Unavailable"):
                    cache.connect()

    def test_get_classification_unavailable(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "false"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            result = cache.get_classification("Hello World")
            assert result is None

    def test_get_classification_empty_text(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            cache._client = MagicMock()
            result = cache.get_classification("")
            assert result is None
            result = cache.get_classification("   ")
            assert result is None

    def test_get_classification_hit(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            mock_client.get.return_value = json.dumps({"label": "bug", "confidence": 0.95})
            cache._client = mock_client
            result = cache.get_classification("Test ticket")
            assert result == {"label": "bug", "confidence": 0.95}

    def test_get_classification_miss(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            mock_client.get.return_value = None
            cache._client = mock_client
            result = cache.get_classification("Test ticket")
            assert result is None

    def test_get_classification_error(self, caplog):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            import logging
            caplog.set_level(logging.WARNING)
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            mock_client.get.side_effect = Exception("Redis error")
            cache._client = mock_client
            result = cache.get_classification("Test ticket")
            assert result is None
            assert "get failed" in caplog.text

    def test_set_classification_unavailable(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "false"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            cache.set_classification("Hello", {"label": "test"})
            assert cache._client is None

    def test_set_classification_success(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true", "REDIS_CACHE_TTL_SECONDS": "3600"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            cache._client = mock_client
            cache.set_classification("Hello", {"label": "test"})
            mock_client.setex.assert_called_once()
            call_args = mock_client.setex.call_args
            assert call_args[0][1] == 3600
            assert json.loads(call_args[0][2]) == {"label": "test"}

    def test_set_classification_empty_text(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            cache._client = mock_client
            cache.set_classification("", {"label": "test"})
            mock_client.setex.assert_not_called()

    def test_set_classification_error(self, caplog):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            import logging
            caplog.set_level(logging.WARNING)
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            mock_client.setex.side_effect = Exception("Redis error")
            cache._client = mock_client
            cache.set_classification("Hello", {"label": "test"})
            assert "set failed" in caplog.text

    def test_get_embedding_unavailable(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "false"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            result = cache.get_embedding("Hello World")
            assert result is None

    def test_get_embedding_hit(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            mock_client.get.return_value = json.dumps([1.0, 2.0, 3.0])
            cache._client = mock_client
            result = cache.get_embedding("Test text")
            assert result == [1.0, 2.0, 3.0]

    def test_get_embedding_miss(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            mock_client.get.return_value = None
            cache._client = mock_client
            result = cache.get_embedding("Test text")
            assert result is None

    def test_get_embedding_error(self, caplog):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            import logging
            caplog.set_level(logging.WARNING)
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            mock_client.get.side_effect = Exception("Redis error")
            cache._client = mock_client
            result = cache.get_embedding("Test text")
            assert result is None
            assert "embedding get failed" in caplog.text

    def test_set_embedding_success(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "true", "REDIS_CACHE_TTL_SECONDS": "1800"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            mock_client = MagicMock()
            cache._client = mock_client
            cache.set_embedding("Hello", [1.0, 2.0, 3.0])
            mock_client.setex.assert_called_once()
            call_args = mock_client.setex.call_args
            assert call_args[0][1] == 1800
            assert json.loads(call_args[0][2]) == [1.0, 2.0, 3.0]

    def test_set_embedding_unavailable(self):
        with patch.dict("os.environ", {"USE_REDIS_CACHE": "false"}, clear=True):
            from services.redis_cache import RedisInferenceCache
            cache = RedisInferenceCache()
            cache.set_embedding("Hello", [1.0, 2.0])
            assert cache._client is None
