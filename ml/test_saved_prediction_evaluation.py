import unittest

import numpy as np

from ml.evaluate_saved_predictions import CLASSES, evaluate_arrays


class SavedPredictionEvaluationTests(unittest.TestCase):
    def setUp(self):
        self.thresholds = {name: 0.5 for name in CLASSES}

    def test_perfect_binary_predictions(self):
        y_true = np.array([
            [1, 0, 1, 0, 1],
            [0, 1, 0, 1, 0],
        ])
        y_prob = np.array([
            [0.9, 0.1, 0.8, 0.2, 0.7],
            [0.2, 0.8, 0.1, 0.9, 0.3],
        ])
        summary, rows = evaluate_arrays(y_true, y_prob, self.thresholds)
        self.assertEqual(summary["macro_class_accuracy"], 1.0)
        self.assertEqual(summary["exact_match_accuracy"], 1.0)
        self.assertEqual(summary["macro_f1"], 1.0)
        self.assertEqual(len(rows), 5)

    def test_exact_match_is_stricter_than_class_accuracy(self):
        y_true = np.array([
            [1, 0, 1, 0, 1],
            [0, 1, 0, 1, 0],
        ])
        y_prob = np.array([
            [0.9, 0.1, 0.8, 0.2, 0.7],
            [0.2, 0.8, 0.1, 0.1, 0.3],
        ])
        summary, _ = evaluate_arrays(y_true, y_prob, self.thresholds)
        self.assertGreater(summary["macro_class_accuracy"], summary["exact_match_accuracy"])

    def test_rejects_shape_mismatch(self):
        with self.assertRaises(ValueError):
            evaluate_arrays(np.zeros((2, 5)), np.zeros((3, 5)), self.thresholds)

    def test_rejects_non_binary_labels(self):
        labels = np.zeros((2, 5))
        labels[0, 0] = 2
        with self.assertRaises(ValueError):
            evaluate_arrays(labels, np.zeros((2, 5)), self.thresholds)


if __name__ == "__main__":
    unittest.main()
