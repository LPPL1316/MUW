"""The register of the networks routes are drawn on (TASK-376, ADR-0320).

One module each; a new network is a new module and one line here. Which
activity goes on which network is in activities/.
"""

from __future__ import annotations

from route_engine.networks import bike, foot
from route_engine.networks.base import Network

NETWORKS_BY_NAME: dict[str, Network] = {
    network.name: network for network in (foot.NETWORK, bike.NETWORK)
}
