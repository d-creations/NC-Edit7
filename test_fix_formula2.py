import sys
sys.path.insert(0, "src")
from ncplot7py.domain.handlers.variable import VariableHandler, CNCState, _safe_eval

state = CNCState()
v = VariableHandler()
try:
    expr = "FIX[2/[6*[0.1+0.2]]]"
    val = v._eval_expression(expr, state)
    print("SUCCESS: val is", val)
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    node_str = "#29=FIX[2/[6*[0.1+0.2]]]"
    # test parsing the assignment via handle directly
    from ncplot7py.shared.nc_nodes import NCCommandNode
    node = NCCommandNode(variable_command=node_str)
    v.handle(node, state)
    print("VAR 29:", state.parameters.get("29"))
except Exception as e:
    import traceback
    traceback.print_exc()
