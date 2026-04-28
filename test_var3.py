import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

parser = NCCommandStringParser()
sys.stdout.write("parse #142=0: ")
sys.stdout.write(getattr(parser.parse("#142=0"), 'variable_command', 'NOT_FOUND') + "\n")
sys.stdout.write("parse #10=#10+1: ")
sys.stdout.write(getattr(parser.parse("#10=#10+1"), 'variable_command', 'NOT_FOUND') + "\n")
