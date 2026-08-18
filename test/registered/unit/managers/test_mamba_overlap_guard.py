"""TDD contract for the Mamba/chunked-prefill overlap safety gate."""

import ast
from typing import Optional
from pathlib import Path
from types import SimpleNamespace

from sglang.test.ci.ci_register import register_cpu_ci

register_cpu_ci(est_time=1, suite="base-a-test-cpu")


SCHEDULER = Path(__file__).resolve().parents[4] / "python/sglang/srt/managers/scheduler.py"


class _Batch:
    def __init__(self, mode):
        self.forward_mode = SimpleNamespace(
            is_extend=lambda: mode == "extend", is_decode=lambda: mode == "decode"
        )
        self.is_extend_in_batch = mode == "extend"
        self.spec_algorithm = SimpleNamespace(is_none=lambda: True)

    def grammar_needs_sync(self):
        return False


def _load_method(name):
    tree = ast.parse(SCHEDULER.read_text())
    fn = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.FunctionDef) and n.name == name
    )
    namespace = {
        "ScheduleBatch": object,
        "Req": object,
        "Optional": Optional,
        "envs": SimpleNamespace(
            SGLANG_DISABLE_CONSECUTIVE_PREFILL_OVERLAP=SimpleNamespace(
                get=lambda: False
            )
        ),
    }
    exec(compile(ast.Module([fn], type_ignores=[]), str(SCHEDULER), "exec"), namespace)
    return namespace[fn.name]


def test_chunked_mamba_snapshot_waits_for_prior_forward_copy():
    method = _load_method("stash_chunked_request")
    calls = []
    event = object()
    scheduler = SimpleNamespace(
        server_args=SimpleNamespace(enable_mamba_extra_buffer=lambda: True),
        enable_overlap=True,
        result_queue=[(None, SimpleNamespace(copy_done=event))],
        schedule_stream=SimpleNamespace(wait_event=lambda value: calls.append(value)),
        tree_cache=object(),
    )
    namespace = {
        "Req": object,
        "maybe_cache_unfinished_req": lambda req, tree, chunked: calls.append("cache"),
    }
    # Recompile with the production helper supplied as a global.
    tree = ast.parse(SCHEDULER.read_text())
    fn = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "stash_chunked_request")
    exec(compile(ast.Module([fn], type_ignores=[]), str(SCHEDULER), "exec"), namespace)
    namespace["stash_chunked_request"](scheduler, object())
    assert calls == [event, "cache"]


def test_non_mamba_extend_overlap_remains_configurable():
    method = _load_method("is_disable_overlap_for_batch")
    scheduler = SimpleNamespace(
        require_mlp_sync=False,
        server_args=SimpleNamespace(
            enable_mamba_extra_buffer=lambda: False,
        ),
        result_queue=[],
    )
    assert method(scheduler, _Batch("extend"), _Batch("extend")) is False
