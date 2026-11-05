"""Running, on the foot network: the first activity."""

from route_engine.activities.base import Activity
from route_engine.networks.foot import FOOT_NETWORK_NAME

# Plausible target distances for running, in metres.
ACTIVITY = Activity("running", (1_000, 50_000), network=FOOT_NETWORK_NAME)
