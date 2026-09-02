"""
Automated unit tests for Grid Sentry Python Client SDK.
Verifies:
1. log() before init() raises clear descriptive error.
2. log() produces compliant payload.
3. Network failures silently handled without crashing caller.
4. Auto-batching buffer groups events.
"""

import unittest
from unittest.mock import patch, MagicMock
from grid_sentry import GridSentry


class TestGridSentryPythonSDK(unittest.TestCase):

    def setUp(self):
        # Reset singleton state
        GridSentry._default_instance = None

    def test_log_before_init_raises_descriptive_error(self):
        with self.assertRaises(RuntimeError) as ctx:
            GridSentry.log_event("test_event")
        self.assertIn("GridSentry is not initialized", str(ctx.exception))

    def test_log_formats_payload_properly(self):
        client = GridSentry(
            api_key="gs_live_test_python_123",
            base_url="http://mock.gridsentry.local",
            app_name="pytest-app",
            auto_start_worker=False,  # disable background thread for test inspection
        )

        client.log(
            event_type="user_login_success",
            user_identifier="py_test@example.com",
            raw_message="Python login OK",
            details={"ip_score": 10},
        )

        self.assertEqual(len(client._buffer), 1)
        ev = client._buffer[0]
        self.assertEqual(ev["event_type"], "user_login_success")
        self.assertEqual(ev["user_identifier"], "py_test@example.com")
        self.assertEqual(ev["details"]["ip_score"], 10)

    @patch("urllib.request.urlopen")
    def test_network_failure_never_crashes_caller(self, mock_urlopen):
        # Simulate severe connection error
        mock_urlopen.side_effect = ConnectionResetError("Connection reset by peer")

        client = GridSentry(
            api_key="gs_live_test_python_123",
            base_url="http://unreachable.gridsentry.local",
            auto_start_worker=False,
        )

        client.log("heartbeat_ping")

        # Must not raise an exception
        flushed_count = client.flush()
        self.assertEqual(flushed_count, 0)

    @patch("urllib.request.urlopen")
    def test_batching_groups_events_into_single_request(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        client = GridSentry(
            api_key="gs_live_test_python_123",
            base_url="http://mock.local",
            batch_size=10,
            auto_start_worker=False,
        )

        client.log("event_1")
        client.log("event_2")
        client.log("event_3")

        flushed = client.flush()
        self.assertEqual(flushed, 3)
        self.assertEqual(mock_urlopen.call_count, 1)


if __name__ == "__main__":
    unittest.main()
