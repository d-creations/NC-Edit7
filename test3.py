import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

parser = NCCommandStringParser()
node = parser.parse("IF#10LT9GOTO300")
print(f"loop='{node.loop_command}'")
