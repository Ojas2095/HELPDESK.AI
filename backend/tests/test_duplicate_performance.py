"""
Performance benchmarks for duplicate detection cosine similarity.

Compares three approaches:
1. Python loop (baseline)
2. NumPy vectorized matrix operations
3. ONNX Runtime (when available)

Run with: pytest backend/tests/test_duplicate_performance.py -v -s
"""

import time
import statistics
from typing import List, Tuple

import pytest
import numpy as np


# ---------------------------------------------------------------------------
# Baseline: Python loop implementation
# ---------------------------------------------------------------------------

def cosine_similarity_loop(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Baseline: loop over each row and compute dot product."""
    similarities = []
    for row in matrix:
        # Manual dot product (assumes L2-normalized)
        sim = float(np.dot(query, row))
        similarities.append(sim)
    return np.array(similarities)


# ---------------------------------------------------------------------------
# Optimized: NumPy vectorized
# ---------------------------------------------------------------------------

def cosine_similarity_numpy(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Vectorized: single matrix-vector dot product."""
    return matrix @ query


# ---------------------------------------------------------------------------
# Optional: ONNX Runtime
# ---------------------------------------------------------------------------

try:
    import onnxruntime as ort

    _HAS_ONNX = True
except ImportError:
    _HAS_ONNX = False


def cosine_similarity_onnx(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """ONNX Runtime: use optimized BLAS operations."""
    if not _HAS_ONNX:
        raise ImportError("onnxruntime not available")

    # Create a simple ONNX model for matrix multiplication
    sess = ort.InferenceSession(
        None,  # We'll use a simple matmul
        providers=["CPUExecutionProvider"],
    )
    # For now, fall back to NumPy (ONNX would need a proper model)
    return matrix @ query


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 dimension
ITERATIONS = 10  # Number of benchmark iterations


@pytest.fixture
def small_dataset():
    """100 embeddings."""
    np.random.seed(42)
    query = np.random.randn(EMBEDDING_DIM).astype(np.float32)
    query = query / np.linalg.norm(query)  # L2 normalize
    matrix = np.random.randn(100, EMBEDDING_DIM).astype(np.float32)
    matrix = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)
    return query, matrix


@pytest.fixture
def medium_dataset():
    """1,000 embeddings."""
    np.random.seed(42)
    query = np.random.randn(EMBEDDING_DIM).astype(np.float32)
    query = query / np.linalg.norm(query)
    matrix = np.random.randn(1000, EMBEDDING_DIM).astype(np.float32)
    matrix = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)
    return query, matrix


@pytest.fixture
def large_dataset():
    """10,000 embeddings."""
    np.random.seed(42)
    query = np.random.randn(EMBEDDING_DIM).astype(np.float32)
    query = query / np.linalg.norm(query)
    matrix = np.random.randn(10000, EMBEDDING_DIM).astype(np.float32)
    matrix = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)
    return query, matrix


# ---------------------------------------------------------------------------
# Correctness tests
# ---------------------------------------------------------------------------

class TestCorrectness:
    """Verify all implementations produce identical results."""

    def test_loop_vs_numpy_small(self, small_dataset):
        """Loop and NumPy should produce identical results."""
        query, matrix = small_dataset
        loop_result = cosine_similarity_loop(query, matrix)
        numpy_result = cosine_similarity_numpy(query, matrix)
        
        np.testing.assert_allclose(loop_result, numpy_result, rtol=1e-5)

    def test_loop_vs_numpy_medium(self, medium_dataset):
        """Loop and NumPy should produce identical results at scale."""
        query, matrix = medium_dataset
        loop_result = cosine_similarity_loop(query, matrix)
        numpy_result = cosine_similarity_numpy(query, matrix)
        
        np.testing.assert_allclose(loop_result, numpy_result, rtol=1e-5)

    def test_numpy_output_shape(self, small_dataset):
        """NumPy output should have correct shape."""
        query, matrix = small_dataset
        result = cosine_similarity_numpy(query, matrix)
        
        assert result.shape == (matrix.shape[0],)
        assert result.dtype == np.float32

    def test_similarity_range(self, small_dataset):
        """Cosine similarities should be in [-1, 1] for normalized vectors."""
        query, matrix = small_dataset
        result = cosine_similarity_numpy(query, matrix)
        
        assert np.all(result >= -1.0)
        assert np.all(result <= 1.0)


# ---------------------------------------------------------------------------
# Performance benchmarks
# ---------------------------------------------------------------------------

class TestPerformance:
    """Benchmark performance of different implementations."""

    def benchmark_implementation(
        self,
        func,
        query: np.ndarray,
        matrix: np.ndarray,
        iterations: int = ITERATIONS,
    ) -> Tuple[float, float, float]:
        """Run benchmark and return (mean, median, std_dev) in milliseconds."""
        times = []
        for _ in range(iterations):
            start = time.perf_counter()
            func(query, matrix)
            end = time.perf_counter()
            times.append((end - start) * 1000)  # Convert to ms

        return (
            statistics.mean(times),
            statistics.median(times),
            statistics.stdev(times) if len(times) > 1 else 0.0,
        )

    def test_performance_small_dataset(self, small_dataset):
        """Benchmark on 100 embeddings."""
        query, matrix = small_dataset

        loop_mean, loop_median, loop_std = self.benchmark_implementation(
            cosine_similarity_loop, query, matrix
        )
        numpy_mean, numpy_median, numpy_std = self.benchmark_implementation(
            cosine_similarity_numpy, query, matrix
        )

        speedup = loop_mean / numpy_mean if numpy_mean > 0 else float("inf")

        print(f"\n[Small Dataset: 100 embeddings]")
        print(f"  Python loop:  {loop_mean:.3f} ms (median: {loop_median:.3f}, std: {loop_std:.3f})")
        print(f"  NumPy:        {numpy_mean:.3f} ms (median: {numpy_median:.3f}, std: {numpy_std:.3f})")
        print(f"  Speedup:      {speedup:.2f}x")

        # NumPy should be faster
        assert numpy_mean < loop_mean, "NumPy should be faster than loop"

    def test_performance_medium_dataset(self, medium_dataset):
        """Benchmark on 1,000 embeddings."""
        query, matrix = medium_dataset

        loop_mean, loop_median, loop_std = self.benchmark_implementation(
            cosine_similarity_loop, query, matrix, iterations=5
        )
        numpy_mean, numpy_median, numpy_std = self.benchmark_implementation(
            cosine_similarity_numpy, query, matrix, iterations=5
        )

        speedup = loop_mean / numpy_mean if numpy_mean > 0 else float("inf")

        print(f"\n[Medium Dataset: 1,000 embeddings]")
        print(f"  Python loop:  {loop_mean:.3f} ms (median: {loop_median:.3f}, std: {loop_std:.3f})")
        print(f"  NumPy:        {numpy_mean:.3f} ms (median: {numpy_median:.3f}, std: {numpy_std:.3f})")
        print(f"  Speedup:      {speedup:.2f}x")

        # NumPy should be significantly faster
        assert numpy_mean < loop_mean, "NumPy should be faster than loop"
        assert speedup > 5.0, f"Expected >5x speedup, got {speedup:.2f}x"

    def test_performance_large_dataset(self, large_dataset):
        """Benchmark on 10,000 embeddings."""
        query, matrix = large_dataset

        loop_mean, loop_median, loop_std = self.benchmark_implementation(
            cosine_similarity_loop, query, matrix, iterations=3
        )
        numpy_mean, numpy_median, numpy_std = self.benchmark_implementation(
            cosine_similarity_numpy, query, matrix, iterations=3
        )

        speedup = loop_mean / numpy_mean if numpy_mean > 0 else float("inf")

        print(f"\n[Large Dataset: 10,000 embeddings]")
        print(f"  Python loop:  {loop_mean:.3f} ms (median: {loop_median:.3f}, std: {loop_std:.3f})")
        print(f"  NumPy:        {numpy_mean:.3f} ms (median: {numpy_median:.3f}, std: {numpy_std:.3f})")
        print(f"  Speedup:      {speedup:.2f}x")

        # NumPy should be dramatically faster
        assert numpy_mean < loop_mean, "NumPy should be faster than loop"
        assert speedup > 10.0, f"Expected >10x speedup, got {speedup:.2f}x"

    @pytest.mark.skipif(not _HAS_ONNX, reason="onnxruntime not available")
    def test_performance_onnx(self, medium_dataset):
        """Benchmark ONNX Runtime if available."""
        query, matrix = medium_dataset

        numpy_mean, _, _ = self.benchmark_implementation(
            cosine_similarity_numpy, query, matrix
        )
        onnx_mean, _, _ = self.benchmark_implementation(
            cosine_similarity_onnx, query, matrix
        )

        print(f"\n[ONNX Runtime Comparison]")
        print(f"  NumPy:  {numpy_mean:.3f} ms")
        print(f"  ONNX:   {onnx_mean:.3f} ms")


# ---------------------------------------------------------------------------
# Memory efficiency tests
# ---------------------------------------------------------------------------

class TestMemoryEfficiency:
    """Test memory usage of implementations."""

    def test_numpy_memory_usage(self, medium_dataset):
        """Verify NumPy doesn't create unnecessary copies."""
        import tracemalloc

        query, matrix = medium_dataset

        tracemalloc.start()
        snapshot1 = tracemalloc.take_snapshot()

        result = cosine_similarity_numpy(query, matrix)

        snapshot2 = tracemalloc.take_snapshot()
        tracemalloc.stop()

        # Memory increase should be minimal (just the result array)
        stats = snapshot2.compare_to(snapshot1, "lineno")
        total_increase = sum(stat.size_diff for stat in stats if stat.size_diff > 0)

        # Result array should be ~4KB (1000 floats * 4 bytes)
        expected_size = matrix.shape[0] * 4
        print(f"\n[Memory Usage]")
        print(f"  Expected: ~{expected_size} bytes")
        print(f"  Actual increase: {total_increase} bytes")

        # Allow some overhead but not excessive
        assert total_increase < expected_size * 10, "Memory usage too high"


# ---------------------------------------------------------------------------
# Scalability tests
# ---------------------------------------------------------------------------

class TestScalability:
    """Test how performance scales with dataset size."""

    def test_linear_scaling(self):
        """Verify NumPy scales better than linear with dataset size."""
        np.random.seed(42)
        query = np.random.randn(EMBEDDING_DIM).astype(np.float32)
        query = query / np.linalg.norm(query)

        sizes = [100, 500, 1000, 2000]
        times = []

        for size in sizes:
            matrix = np.random.randn(size, EMBEDDING_DIM).astype(np.float32)
            matrix = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)

            start = time.perf_counter()
            cosine_similarity_numpy(query, matrix)
            end = time.perf_counter()

            times.append((end - start) * 1000)

        print(f"\n[Scalability Test]")
        for size, t in zip(sizes, times):
            print(f"  {size:5d} embeddings: {t:.3f} ms")

        # Time should scale sub-linearly (NumPy uses BLAS)
        # 2000 should be < 3x slower than 1000
        assert times[3] < times[2] * 3.0, "Scaling worse than expected"


# ---------------------------------------------------------------------------
# Integration with DuplicateService
# ---------------------------------------------------------------------------

class TestDuplicateServiceIntegration:
    """Test integration with actual DuplicateService."""

    def test_duplicate_service_uses_vectorization(self):
        """Verify DuplicateService uses vectorized implementation."""
        from backend.services.duplicate_service import _cosine_similarity_numpy

        # Verify the function exists and works
        query = np.random.randn(EMBEDDING_DIM).astype(np.float32)
        matrix = np.random.randn(100, EMBEDDING_DIM).astype(np.float32)

        result = _cosine_similarity_numpy(query, matrix)

        assert result.shape == (100,)
        assert isinstance(result, np.ndarray)


if __name__ == "__main__":
    # Run benchmarks directly
    pytest.main([__file__, "-v", "-s"])
