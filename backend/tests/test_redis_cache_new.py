"""Unit tests for backend/services/redis_cache.py - Redis inference cache.

Issue: #1106 - test: add unit tests for redis_cache service
"""

import unittest
import hashlib
from unittest.mock import patch, MagicMock


class TestTruthy(unittest.TestCase):
    """Tests for the _truthy helper function."""

    def test_truthy_one(self):
        from backend.services.redis_cache import _truthy
        self.assertTrue(_truthy("1"))

    def test_truthy_true(self):
        from backend.services.redis_cache import _truthy
        self.assertTrue(_truthy("true"))

    def test_truthy_yes(self):
        from backend.services.redis_cache import _truthy
        self.assertTrue(_truthy("yes"))

    def test_truthy_on(self):
        from backend.services.redis_cache import _truthy
        self.assertTrue(_truthy("on"))

    def test_truthy_uppercase(self):
        from backend.services.redis_cache import _truthy
        self.assertTrue(_truthy("TRUE"))
        self.assertTrue(_truthy("YES"))
        self.assertTrue(_truthy("ON"))

    def test_truthy_mixed_case(self):
        from backend.services.redis_cache import _truthy
        self.assertTrue(_truthy("True"))
        self.assertTrue(_truthy("Yes"))

    def test_truthy_with_whitespace(self):
        from backend.services.redis_cache import _truthy
        self.assertTrue(_truthy("  1  "))
        self.assertTrue(_truthy("  true  "))

    def test_falsy_zero(self):
        from backend.services.redis_cache import _truthy
        self.assertFalse(_truthy("0"))

    def test_falsy_false(self):
        from backend.services.redis_cache import _truthy
        self.assertFalse(_truthy("false"))

    def test_falsy_no(self):
        from backend.services.redis_cache import _truthy
        self.assertFalse(_truthy("no"))

    def test_falsy_off(self):
        from backend.services.redis_cache import _truthy
        self.assertFalse(_truthy("off"))

    def test_falsy_none(self):
        from backend.services.redis_cache import _truthy
        self.assertFalse(_truthy(None))

    def test_falsy_empty_string(self):
        from backend.services.redis_cache import _truthy
        self.assertFalse(_truthy(""))

    def test_falsy_random_string(self):
        from backend.services.redis_cache import _truthy
        self.assertFalse(_truthy("random"))
        self.assertFalse(_truthy("enabled"))


class TestTextKey(unittest.TestCase):
    """Tests for the _text_key helper function."""

    def test_normal_text(self):
        from backend.services.redis_cache import _text_key
        expected_digest = hashlib.md5("hello world".encode("utf-8")).hexdigest()
        result = _text_key("prefix:", "hello world")
        self.assertEqual(result, f"prefix:{expected_digest}")

    def test_empty_text_returns_none(self):
        from backend.services.redis_cache import _text_key
        self.assertIsNone(_text_key("prefix:", ""))

    def test_whitespace_only_returns_none(self):
        from backend.services.redis_cache import _text_key
        self.assertIsNone(_text_key("prefix:", "   "))

    def test_text_with_whitespace_trimmed(self):
        from backend.services.redis_cache import _text_key
        trimmed_digest = hashlib.md5("hello".encode("utf-8")).hexdigest()
        result = _text_key("p:", "  hello  ")
        self.assertEqual(result, f"p:{trimmed_digest}")

    def test_case_insensitive(self):
        from backend.services.redis_cache import _text_key
        k1 = _text_key("p:", "Hello World")
        k2 = _text_key("p:", "hello world")
        self.assertEqual(k1, k2)

    def test_different_prefixes(self):
        from backend.services.redis_cache import _text_key
        k1 = _text_key("cls:", "text")
        k2 = _text_key("emb:", "text")
        self.assertNotEqual(k1, k2)

    def test_different_texts_different_keys(self):
        from backend.services.redis_cache import _text_key
        k1 = _text_key("p:", "text one")
        k2 = _text_key("p:", "text two")
        self.assertNotEqual(k1, k2)

    def test_unicode_text(self):
        from backend.services.redis_cache import _text_key
        result = _text_key("p:", "你好世界")
        self.assertIsNotNone(result)
        self.assertTrue(result.startswith("p:"))

    def test_special_characters(self):
        from backend.services.redis_cache import _text_key
        result = _text_key("p:", "test@#$%^&*()")
        self.assertIsNotNone(result)


class TestRedisInferenceCacheInit(unittest.TestCase):
    """Tests for RedisInferenceCache initialization."""

    def test_init_disabled_by_default(self):
        """Without env vars, cache is disabled."""
        from backend.services.redis_cache import RedisInferenceCache
        with patch.dict('os.environ', {}, clear=True):
            cache = RedisInferenceCache()
            self.assertFalse(cache.enabled)
            self.assertFalse(cache.allow_degraded)
            self.assertEqual(cache.ttl_seconds, 3600)
            self.assertFalse(cache.available)

    def test_init_enabled(self):
        """With USE_REDIS_CACHE=true, cache is enabled."""
        from backend.services.redis_cache import RedisInferenceCache
        with patch.dict('os.environ', {'USE_REDIS_CACHE': 'true'}):
            cache = RedisInferenceCache()
            self.assertTrue(cache.enabled)
            self.assertFalse(cache.available)  # No client yet

    def test_init_allow_degraded(self):
        """ALLOW_DEGRADED_STARTUP=true enables degraded mode."""
        from backend.services.redis_cache import RedisInferenceCache
        with patch.dict('os.environ', {'ALLOW_DEGRADED_STARTUP': '1'}):
            cache = RedisInferenceCache()
            self.assertTrue(cache.allow_degraded)

    def test_init_custom_ttl(self):
        """Custom REDIS_CACHE_TTL_SECONDS is respected."""
        from backend.services.redis_cache import RedisInferenceCache
        with patch.dict('os.environ', {'REDIS_CACHE_TTL_SECONDS': '7200'}):
            cache = RedisInferenceCache()
            self.assertEqual(cache.ttl_seconds, 7200)

    def test_init_all_env_vars(self):
        """All env vars set simultaneously."""
        from backend.services.redis_cache import RedisInferenceCache
        with patch.dict('os.environ', {
            'USE_REDIS_CACHE': 'true',
            'ALLOW_DEGRADED_STARTUP': 'yes',
            'REDIS_CACHE_TTL_SECONDS': '1800',
        }):
            cache = RedisInferenceCache()
            self.assertTrue(cache.enabled)
            self.assertTrue(cache.allow_degraded)
            self.assertEqual(cache.ttl_seconds, 1800)


class TestRedisInferenceCacheConnect(unittest.TestCase):
    """Tests for the connect method."""

    def test_connect_disabled_noop(self):
        """When disabled, connect does nothing."""
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = False
        # Should not raise
        cache.connect()
        self.assertFalse(cache.available)

    def test_connect_success(self):
        """Successful Redis connection."""
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = True

        mock_client = MagicMock()
        mock_redis = MagicMock()
        mock_redis.from_url.return_value = mock_client

        with patch.dict('os.environ', {'REDIS_URL': 'redis://localhost:6379/0'}):
            with patch.dict('sys.modules', {'redis': mock_redis}):
                cache.connect()
                self.assertTrue(cache.available)
                self.assertEqual(cache._client, mock_client)
                mock_client.ping.assert_called_once()

    def test_connect_failure_with_degraded(self):
        """Connection failure with allow_degraded=True logs warning."""
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = True
        cache.allow_degraded = True

        mock_redis = MagicMock()
        mock_redis.from_url.side_effect = Exception("Connection refused")

        with patch.dict('sys.modules', {'redis': mock_redis}):
            cache.connect()
            self.assertFalse(cache.available)
            self.assertIsNone(cache._client)

    def test_connect_failure_without_degraded(self):
        """Connection failure without allow_degraded raises RuntimeError."""
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = True
        cache.allow_degraded = False

        mock_redis = MagicMock()
        mock_redis.from_url.side_effect = Exception("Connection refused")

        with patch.dict('sys.modules', {'redis': mock_redis}):
            with self.assertRaises(RuntimeError) as ctx:
                cache.connect()
            self.assertIn("Unavailable", str(ctx.exception))
            self.assertFalse(cache.available)


class TestRedisInferenceCacheClassification(unittest.TestCase):
    """Tests for get_classification and set_classification."""

    def setUp(self):
        from backend.services.redis_cache import RedisInferenceCache
        self.cache = RedisInferenceCache()
        self.cache.enabled = True
        self.mock_client = MagicMock()
        self.cache._client = self.mock_client

    def test_get_classification_cache_hit(self):
        """Cache returns stored classification."""
        self.mock_client.get.return_value = '{"category":"bug","confidence":0.95}'
        result = self.cache.get_classification("error in login")
        self.assertEqual(result, {"category": "bug", "confidence": 0.95})
        self.mock_client.get.assert_called_once()

    def test_get_classification_cache_miss(self):
        """Cache miss returns None."""
        self.mock_client.get.return_value = None
        result = self.cache.get_classification("new text")
        self.assertIsNone(result)

    def test_get_classification_unavailable(self):
        """When cache unavailable, returns None."""
        self.cache._client = None
        result = self.cache.get_classification("some text")
        self.assertIsNone(result)

    def test_get_classification_empty_text(self):
        """Empty text returns None (no cache key)."""
        result = self.cache.get_classification("")
        self.assertIsNone(result)
        self.mock_client.get.assert_not_called()

    def test_get_classification_whitespace_text(self):
        """Whitespace-only text returns None."""
        result = self.cache.get_classification("   ")
        self.assertIsNone(result)

    def test_get_classification_error_handling(self):
        """Redis error during get returns None gracefully."""
        self.mock_client.get.side_effect = Exception("Redis timeout")
        result = self.cache.get_classification("text")
        self.assertIsNone(result)

    def test_set_classification_success(self):
        """Classification is stored with TTL."""
        payload = {"category": "feature", "confidence": 0.88}
        self.cache.set_classification("test text", payload)
        self.mock_client.setex.assert_called_once()

    def test_set_classification_unavailable(self):
        """When unavailable, set does nothing."""
        self.cache._client = None
        self.cache.set_classification("text", {"k": "v"})
        # Should not raise

    def test_set_classification_empty_text(self):
        """Empty text is not cached."""
        self.cache.set_classification("", {"k": "v"})
        self.mock_client.setex.assert_not_called()

    def test_set_classification_error_handling(self):
        """Redis error during set is caught gracefully."""
        self.mock_client.setex.side_effect = Exception("Redis timeout")
        # Should not raise
        self.cache.set_classification("text", {"k": "v"})

    def test_get_classification_invalid_json(self):
        """Invalid JSON in cache returns None."""
        self.mock_client.get.return_value = "not valid json {"
        result = self.cache.get_classification("text")
        self.assertIsNone(result)


class TestRedisInferenceCacheEmbedding(unittest.TestCase):
    """Tests for get_embedding and set_embedding."""

    def setUp(self):
        from backend.services.redis_cache import RedisInferenceCache
        self.cache = RedisInferenceCache()
        self.cache.enabled = True
        self.mock_client = MagicMock()
        self.cache._client = self.mock_client

    def test_get_embedding_cache_hit(self):
        """Cache returns stored embedding with float conversion."""
        self.mock_client.get.return_value = '[0.1, 0.2, 0.3, 0.4]'
        result = self.cache.get_embedding("hello")
        self.assertEqual(result, [0.1, 0.2, 0.3, 0.4])
        self.assertIsInstance(result[0], float)

    def test_get_embedding_cache_miss(self):
        """Cache miss returns None."""
        self.mock_client.get.return_value = None
        result = self.cache.get_embedding("unknown text")
        self.assertIsNone(result)

    def test_get_embedding_unavailable(self):
        """When unavailable, returns None."""
        self.cache._client = None
        result = self.cache.get_embedding("text")
        self.assertIsNone(result)

    def test_get_embedding_empty_text(self):
        """Empty text returns None."""
        result = self.cache.get_embedding("")
        self.assertIsNone(result)

    def test_get_embedding_error_handling(self):
        """Redis error returns None."""
        self.mock_client.get.side_effect = Exception("Redis timeout")
        result = self.cache.get_embedding("text")
        self.assertIsNone(result)

    def test_set_embedding_success(self):
        """Embedding is stored with TTL."""
        embedding = [0.5, 0.6, 0.7]
        self.cache.set_embedding("test text", embedding)
        self.mock_client.setex.assert_called_once()

    def test_set_embedding_unavailable(self):
        """When unavailable, set does nothing."""
        self.cache._client = None
        self.cache.set_embedding("text", [0.1, 0.2])
        # Should not raise

    def test_set_embedding_empty_text(self):
        """Empty text is not cached."""
        self.cache.set_embedding("", [0.1, 0.2])
        self.mock_client.setex.assert_not_called()

    def test_set_embedding_error_handling(self):
        """Redis error during set is caught."""
        self.mock_client.setex.side_effect = Exception("Redis timeout")
        self.cache.set_embedding("text", [0.1, 0.2])
        # Should not raise

    def test_get_embedding_float_conversion(self):
        """Integer values in JSON are converted to float."""
        self.mock_client.get.return_value = '[1, 2, 3]'
        result = self.cache.get_embedding("text")
        self.assertEqual(result, [1.0, 2.0, 3.0])
        self.assertTrue(all(isinstance(v, float) for v in result))


class TestRedisInferenceCacheAvailable(unittest.TestCase):
    """Tests for the available property."""

    def test_available_enabled_with_client(self):
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = True
        cache._client = MagicMock()
        self.assertTrue(cache.available)

    def test_available_disabled(self):
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = False
        cache._client = MagicMock()
        self.assertFalse(cache.available)

    def test_available_enabled_no_client(self):
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = True
        cache._client = None
        self.assertFalse(cache.available)


class TestRedisCachePrefixes(unittest.TestCase):
    """Tests that classification and embedding use different prefixes."""

    def test_classification_prefix(self):
        from backend.services.redis_cache import CLASSIFICATION_PREFIX
        self.assertIn("cls", CLASSIFICATION_PREFIX)

    def test_embedding_prefix(self):
        from backend.services.redis_cache import EMBEDDING_PREFIX
        self.assertIn("emb", EMBEDDING_PREFIX)

    def test_different_prefixes(self):
        from backend.services.redis_cache import CLASSIFICATION_PREFIX, EMBEDDING_PREFIX
        self.assertNotEqual(CLASSIFICATION_PREFIX, EMBEDDING_PREFIX)


class TestRedisInferenceCacheIntegration(unittest.TestCase):
    """Integration-like tests combining multiple operations."""

    def test_set_get_classification_roundtrip(self):
        """Set then get classification returns same data."""
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = True
        mock_client = MagicMock()
        cache._client = mock_client

        payload = {"category": "bug", "confidence": 0.95}
        mock_client.get.return_value = '{"category":"bug","confidence":0.95}'

        cache.set_classification("error 500", payload)
        result = cache.get_classification("error 500")
        self.assertEqual(result, payload)

    def test_set_get_embedding_roundtrip(self):
        """Set then get embedding returns same data as floats."""
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = True
        mock_client = MagicMock()
        cache._client = mock_client

        embedding = [0.1, 0.2, 0.3]
        mock_client.get.return_value = '[0.1, 0.2, 0.3]'

        cache.set_embedding("test", embedding)
        result = cache.get_embedding("test")
        self.assertEqual(result, [0.1, 0.2, 0.3])

    def test_cache_operations_when_disabled(self):
        """All operations are no-ops when cache is disabled."""
        from backend.services.redis_cache import RedisInferenceCache
        cache = RedisInferenceCache()
        cache.enabled = False
        cache._client = None

        # None of these should raise
        self.assertIsNone(cache.get_classification("text"))
        self.assertIsNone(cache.get_embedding("text"))
        cache.set_classification("text", {"k": "v"})
        cache.set_embedding("text", [0.1, 0.2])


if __name__ == '__main__':
    unittest.main()
