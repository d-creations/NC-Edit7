
from ncplot7py.shared.registry import registry
from ncplot7py.cli.main import bootstrap
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser


def test_register_and_get_parser():
    # Bootstrap registers builtin adapters and is safe to call multiple times
    bootstrap(registry)
    cls = registry.get("parser", "nc_command")
    assert cls is NCCommandStringParser

    # Instantiate and run parse on a simple G-code line
    parser = cls()
    node = parser.parse("G1 X10 Y5", line_nr=7)
    assert "G1" in node.g_code
    assert node.command_parameter.get("X") == "10"
    assert node.command_parameter.get("Y") == "5"


def test_register_custom_class():
    # Ensure registry can store arbitrary classes and retrieve them
    class Dummy:
        pass

    registry.register("test-kind", "dummy", Dummy)
    got = registry.get("test-kind", "dummy")
    assert got is Dummy
