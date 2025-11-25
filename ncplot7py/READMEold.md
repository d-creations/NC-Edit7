# ncplot7py
NC Code Plot for CNC Code



# run Tests
& C:/Users/Damian/Project/ncplot7py/ncplot7py/.venv/Scripts/Activate.ps1

 $env:PYTHONPATH = 'src'; python -m unittest discover -s tests/unit -p "test_*.py" -v

 $env:PYTHONPATH='src'; python -m unittest discover -s tests/integration -p "test_*.py" -v

## Error handling and i18n

This project provides structured, localized errors for CNC/NC parsing and runtime.

- Use `ExceptionNode` and `ExceptionTyps` from `ncplot7py.domain.exceptions`.
- Prefer `raise_nc_error(...)` to attach file/line/column/context and infer the caret position.
-- Localize via XML catalogs under `src/ncplot7py/locales/{lang}.xml` using keys `{typ_value}:{code}`.

Quick example:

```python
from ncplot7py.domain.exceptions import ExceptionTyps, raise_nc_error
from ncplot7py.domain.i18n import MessageCatalog

try:
	raise_nc_error(
		ExceptionTyps.NCCodeErrors, 1001,
		value="M30", file="program.nc", line=12,
		source_line="N12 G1 X10 Y10 M30",
	)
except Exception as exc:
	print(MessageCatalog().format_exception(exc, lang="en"))
```

See `docs/CODING_GUIDELINES.md` and `docs/COPILOT.md` for details.