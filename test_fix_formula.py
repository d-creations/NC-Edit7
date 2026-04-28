import sys
sys.path.insert(0, "src")
from ncplot7py.domain.handlers.variable import VariableHandler, CNCState

state = CNCState()
v = VariableHandler()
try:
    val = v._eval_expression("FIX[5/[6*[0.01+0.02]]]", state)
    print("SUCCESS: val is", val)
except Exception as e:
    import traceback
    traceback.print_exc()
