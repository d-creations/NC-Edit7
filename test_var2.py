import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

parser = NCCommandStringParser()
node = parser.parse("#142=0")
print("gcode:", node.g_code_command)
print("param:", node.command_parameter)
print("loop:", node.loop_command)
print("calc:", getattr(node, 'calculations', None))

