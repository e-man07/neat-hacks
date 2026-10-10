import os

os.environ.setdefault("NEATLOGS_API_KEY", "")  # tests never export traces
os.environ["NEATLOGS_API_KEY"] = ""

import pytest

from ops.db import OpsDB


@pytest.fixture
def db():
    return OpsDB(":memory:")
