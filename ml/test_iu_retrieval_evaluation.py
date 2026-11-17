import unittest

from ml.evaluate_iu_retrieval import ranking_metrics, weak_label_states


class WeakLabelTests(unittest.TestCase):
    def test_structured_mesh_and_problems_are_positive(self):
        report = (
            "Source: IU\n"
            "MeSH terms: Pleural Effusion/bilateral/small;Pulmonary Atelectasis/base/left\n"
            "Problems: Pleural Effusion;Pulmonary Atelectasis\n"
        )
        states = weak_label_states(report)
        self.assertEqual(states["Effusion"], "positive")
        self.assertEqual(states["Atelectasis"], "positive")
        self.assertEqual(states["Infiltration"], "unknown")

    def test_explicit_negations_are_negative(self):
        report = (
            "Findings: Lungs are clear without pleural effusion, mass, nodule, "
            "infiltrate or atelectasis.\n"
            "Impression: No acute cardiopulmonary abnormality.\n"
        )
        states = weak_label_states(report)
        for disease in ("Effusion", "Mass", "Nodule", "Infiltration", "Atelectasis"):
            self.assertEqual(states[disease], "negative", disease)

    def test_positive_and_negative_mentions_are_separated(self):
        report = (
            "Findings: Small left pleural effusion.\n"
            "Impression: No pulmonary nodules or masses.\n"
        )
        states = weak_label_states(report)
        self.assertEqual(states["Effusion"], "positive")
        self.assertEqual(states["Nodule"], "negative")
        self.assertEqual(states["Mass"], "negative")

    def test_unmentioned_disease_is_not_assumed_negative(self):
        report = "Findings: Stable cardiomegaly.\n"
        states = weak_label_states(report)
        self.assertEqual(states["Effusion"], "unknown")
        self.assertEqual(states["Nodule"], "unknown")


class RankingMetricTests(unittest.TestCase):
    def test_perfect_ranking(self):
        result = ranking_metrics([True, True, False], 3)
        self.assertAlmostEqual(result["precision"], 2 / 3)
        self.assertAlmostEqual(result["recall"], 1.0)
        self.assertAlmostEqual(result["map"], 1.0)
        self.assertAlmostEqual(result["ndcg"], 1.0)

    def test_relevant_case_at_rank_three(self):
        result = ranking_metrics([False, False, True, False], 3)
        self.assertAlmostEqual(result["precision"], 1 / 3)
        self.assertAlmostEqual(result["recall"], 1.0)
        self.assertAlmostEqual(result["map"], 1 / 3)
        self.assertAlmostEqual(result["ndcg"], 0.5)


if __name__ == "__main__":
    unittest.main()
