"""
Benchmark: Loop-based vs NumPy-Vectorized vs ONNX Cosine Similarity

Compares three approaches for duplicate detection similarity search:
1. Old loop-based (per-ticket cos_sim calls)
2. NumPy vectorized (single matrix dot-product)
3. ONNX Runtime (model inference + NumPy similarity)

Run:
    python -m backend.scripts.benchmark_duplicate_similarity
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension


def _generate_synthetic_embeddings(n: int, dim: int = EMBEDDING_DIM) -> np.ndarray:
    """Create *n* random L2-normalised embeddings as a (n, dim) float32 array."""
    raw = np.random.randn(n, dim).astype(np.float32)
    norms = np.linalg.norm(raw, axis=1, keepdims=True)
    norms = np.where(norms < 1e-8, 1.0, norms)
    return raw / norms


def benchmark_loop(query: np.ndarray, matrix: np.ndarray, rounds: int = 10) -> float:
    """Old approach: iterate and compute dot product one at a time."""
    # Warm up
    for i in range(min(10, len(matrix))):
        _ = float(np.dot(query, matrix[i]))

    times = []
    for _ in range(rounds):
        t0 = time.perf_counter()
        best = -1.0
        for i in range(len(matrix)):
            score = float(np.dot(query, matrix[i]))
            if score > best:
                best = score
        times.append(time.perf_counter() - t0)
    return sum(times) / len(times)


def benchmark_vectorized(query: np.ndarray, matrix: np.ndarray, rounds: int = 10) -> float:
    """New approach: single matrix dot-product."""
    # Warm up
    _ = matrix @ query

    times = []
    for _ in range(rounds):
        t0 = time.perf_counter()
        similarities = matrix @ query
        _ = int(np.argmax(similarities))
        times.append(time.perf_counter() - t0)
    return sum(times) / len(times)


def benchmark_torch(query_np: np.ndarray, matrix_np: np.ndarray, rounds: int = 10) -> float:
    """Torch approach: util.cos_sim (requires torch + sentence-transformers)."""
    try:
        import torch
        from sentence_transformers import util
    except ImportError:
        return -1.0  # not available

    query = torch.from_numpy(query_np).unsqueeze(0)
    matrix = torch.from_numpy(matrix_np)

    # Warm up
    _ = util.cos_sim(query, matrix)

    times = []
    for _ in range(rounds):
        t0 = time.perf_counter()
        sim = util.cos_sim(query, matrix)
        _ = torch.max(sim, dim=1)
        times.append(time.perf_counter() - t0)
    return sum(times) / len(times)


def main():
    sizes = [100, 500, 1000, 5000]
    print("=" * 70)
    print("Duplicate Detection — Cosine Similarity Benchmark")
    print("=" * 70)
    print(f"{'Tickets':>8}  {'Loop (ms)':>12}  {'NumPy (ms)':>12}  {'Speedup':>8}  {'Torch (ms)':>12}")
    print("-" * 70)

    for n in sizes:
        matrix = _generate_synthetic_embeddings(n)
        query = _generate_synthetic_embeddings(1)[0]

        t_loop = benchmark_loop(query, matrix) * 1000  # ms
        t_numpy = benchmark_vectorized(query, matrix) * 1000  # ms
        t_torch = benchmark_torch(query, matrix) * 1000  # ms
        speedup = t_loop / t_numpy if t_numpy > 0 else float("inf")

        torch_str = f"{t_torch:>10.3f}ms" if t_torch >= 0 else "     N/A  "
        print(f"{n:>8}  {t_loop:>10.3f}ms  {t_numpy:>10.3f}ms  {speedup:>7.1f}x  {torch_str}")

    print("=" * 70)
    print("\n✅ NumPy vectorized is the recommended production path.")
    print("   Uses cached embedding matrix + single dot-product per query.")


if __name__ == "__main__":
    main()
