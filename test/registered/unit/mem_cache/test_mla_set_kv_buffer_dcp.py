"""``MLATokenToKVPool.set_kv_buffer`` must translate DCP locs, not just mask them.

Under DCP the shared allocator hands out VIRTUAL locs spanning
``[0, size * dcp_size)``; each rank owns the locs congruent to its rank and stores
them at ``loc // dcp_size``. The Triton path does exactly that
(``set_mla_kv_buffer_kernel``: ``is_valid = loc % DCP_WORLD_SIZE == DCP_RANK``,
then ``safe_loc // DCP_WORLD_SIZE``). The Python fallback used to apply the owner
mask and then index the per-rank buffer with the UNDIVIDED loc, which writes row
``k * dcp_size + r`` instead of row ``k`` -- silent cross-request corruption for
low locs, and an out-of-bounds index for the (large majority of) locs at or above
the per-rank row count.

The cases below pin, in order: the mixed-ownership path, the all-owned path
(where the mask filter is SKIPPED but the translation is still required -- the
easiest half of this bug to reintroduce), the highest virtual loc the allocator
can legally emit, and DCP-off identity.

Pure indexing semantics on CPU: no GPU, no model, no allocator.
"""

import unittest
from types import SimpleNamespace

import torch

from sglang.srt.mem_cache import memory_pool as memory_pool_mod
from sglang.srt.mem_cache.memory_pool import MLATokenToKVPool
from sglang.srt.runtime_context import get_parallel
from sglang.test.ci.ci_register import register_cpu_ci

register_cpu_ci(est_time=2, suite="base-a-test-cpu")

DIM = 4
ROWS = 16  # per-rank rows (the pool reserves ROWS + PAGE)
PAGE = 2
DCP = 4
RANK = 1


def _pool():
    """A stand-in carrying only the attributes ``set_kv_buffer`` touches."""
    return SimpleNamespace(
        size=ROWS,
        page_size=PAGE,
        start_layer=0,
        dtype=torch.float32,
        store_dtype=torch.float32,
        dsa_kv_cache_store_fp8=False,
        kv_buffer=[torch.zeros(ROWS + PAGE, DIM)],
    )


def _payload(n):
    # 1-based so a written row is never all-zeros.
    return 1.0 + torch.arange(n * DIM, dtype=torch.float32).reshape(n, DIM)


def _written_rows(pool):
    return [r for r in range(ROWS + PAGE) if pool.kv_buffer[0][r].any()]


class TestMLASetKvBufferDcp(unittest.TestCase):
    def setUp(self):
        self.layer = SimpleNamespace(layer_id=0)

    def test_mixed_ownership_lands_on_translated_rows(self):
        pool, val = _pool(), _payload(8)
        with get_parallel().override(
            dcp_enabled=True, attn_dcp_size=DCP, attn_dcp_rank=RANK
        ):
            MLATokenToKVPool.set_kv_buffer(pool, self.layer, torch.arange(8), val, None)
        # Of locs 0..7 rank 1 owns 1 and 5, which address rows 0 and 1.
        self.assertEqual(_written_rows(pool), [0, 1])
        torch.testing.assert_close(pool.kv_buffer[0][0], val[1])
        torch.testing.assert_close(pool.kv_buffer[0][1], val[5])

    def test_all_owned_still_translates(self):
        """The mask filter is skipped when every loc is owned -- the divide is not."""
        pool, val = _pool(), _payload(4)
        with get_parallel().override(
            dcp_enabled=True, attn_dcp_size=DCP, attn_dcp_rank=RANK
        ):
            MLATokenToKVPool.set_kv_buffer(
                pool, self.layer, torch.tensor([1, 5, 9, 13]), val, None
            )
        self.assertEqual(_written_rows(pool), [0, 1, 2, 3])

    def test_highest_legal_virtual_loc_is_in_bounds(self):
        pool = _pool()
        top = (ROWS + PAGE) * DCP - DCP + RANK
        with get_parallel().override(
            dcp_enabled=True, attn_dcp_size=DCP, attn_dcp_rank=RANK
        ):
            MLATokenToKVPool.set_kv_buffer(
                pool, self.layer, torch.tensor([top]), _payload(1), None
            )
        self.assertEqual(_written_rows(pool), [top // DCP])

    def test_probe_bound_is_stated_in_the_virtual_space(self):
        seen = []
        original = memory_pool_mod.maybe_detect_oob
        memory_pool_mod.maybe_detect_oob = lambda loc, lo, hi, msg: seen.append(hi)
        try:
            pool = _pool()
            with get_parallel().override(
                dcp_enabled=True, attn_dcp_size=DCP, attn_dcp_rank=RANK
            ):
                MLATokenToKVPool.set_kv_buffer(
                    pool, self.layer, torch.tensor([RANK]), _payload(1), None
                )
        finally:
            memory_pool_mod.maybe_detect_oob = original
        self.assertEqual(seen, [(ROWS + PAGE) * DCP])

    def test_dcp_off_is_unchanged(self):
        pool, val = _pool(), _payload(3)
        with get_parallel().override(dcp_enabled=False):
            MLATokenToKVPool.set_kv_buffer(
                pool, self.layer, torch.tensor([0, 1, 2]), val, None
            )
        self.assertEqual(_written_rows(pool), [0, 1, 2])
        torch.testing.assert_close(pool.kv_buffer[0][:3], val)


if __name__ == "__main__":
    unittest.main()
