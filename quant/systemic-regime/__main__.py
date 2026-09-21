"""Systemic Regime Engine — independent statistical worker (not AI).

PCA: ordinary StandardScaler + PCA with n_components=1. Never called Dynamic PCA.
HMM: hmmlearn GaussianHMM, 3-state production model (NORMAL / STRESS BUILDING / CRISIS).
Training is a scheduled weekly CLI. Inference loads the approved frozen bundle and
writes JSON for Node to persist. UI and PLATO read persisted output only.

This module does not change Pressure Index weights.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from fred_pipeline import load_panel
from inference import main as inference_main
from train import train
from validate import run_validation


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("train", "infer", "validate"))
    parser.add_argument("--from-json")
    parser.add_argument("--from-csv")
    parser.add_argument("--model-dir")
    parser.add_argument("--out")
    parser.add_argument("--history-out")
    parser.add_argument("--n-states", type=int, choices=(2, 3, 4))
    parser.add_argument("--skip-compare", action="store_true")
    args, rest = parser.parse_known_args()
    if args.command == "train":
        if not args.model_dir:
            raise SystemExit("--model-dir is required for train")
        panel = load_panel(from_json=args.from_json, from_csv=args.from_csv)
        result = train(panel, Path(args.model_dir), n_states=args.n_states, compare_states=not args.skip_compare)
        print(json.dumps(result, default=str))
        return
    if args.command == "validate":
        if not args.out:
            raise SystemExit("--out is required for validate")
        panel = load_panel(from_json=args.from_json, from_csv=args.from_csv)
        report = run_validation(panel)
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(report, indent=2))
        print(json.dumps({"ok": True, "chosenNStates": report["architectureChoice"]["chosenNStates"]}))
        return
    inference_main()


if __name__ == "__main__":
    main()
