# Copilot Instructions: Clean Architecture guidance for ncplot7py

Purpose
-------
This document tells Copilot (or other AI assistants) how to produce code aligned with a clean, maintainable architecture for a large Python project. It also includes notes for TypeScript when the repo grows into multi-language or monorepo setups.

High-level contract for suggestions
----------------------------------
- Inputs: existing code context and a concrete change request (file snippet, issue, or feature description).
- Outputs: small, focused, well-typed code changes; updated tests; brief rationale in PR/commit message when behavior changes.
- Error modes: when a suggestion breaks API, include a migration note and tests; prefer additive changes.

Core architecture principles
---------------------------
- Layering: keep Domain (core rules), Application (use-cases), Interfaces/Adapters, and Infrastructure separate.
- Dependency rule: code dependencies point inward (outer layers depend on inner layers, inner layers know nothing about outer layers).
- Dependency inversion: use abstractions (Protocols/Interfaces) so application code depends on contracts, not concrete implementations.
- Side-effects at the edges: I/O (DB, network, filesystem, plotting libraries) belong only in infrastructure/adapters.

Recommended repository layout (scalable)
----------------------------------------
Use a src-style package layout. Example for a single large package:

src/
	ncplot7py/
		domain/
			models.py        # dataclasses, value objects, domain errors
			services.py      # pure domain logic
		application/
			usecases.py      # orchestrators that use domain services & ports
		adapters/
			api.py           # controllers/entrypoints (FastAPI, CLI)
			serializers.py   # mapping external <-> domain types
		infrastructure/
			netcdf_reader.py # concrete I/O implementations
			persistence.py   # DB adapters
			plotting_impl.py # plotting wrapper implementations
		shared/
			config.py
			types.py
		__init__.py
tests/
	unit/
	integration/
pyproject.toml
README.md

For monorepos or multi-package setups, apply the same layer boundaries inside each package.

Typing & interfaces
-------------------
- Python: use dataclasses for domain models, typing.Protocol for ports, and mypy/pyright in CI.
- Keep Protocols near the consumer (application/usecase) — not buried in infrastructure.

How to structure a new feature (recommended steps)
-----------------------------------------------
1. Design domain types (dataclasses) and pure validations in `domain/`.
2. Implement a use-case in `application/` that depends on a small Protocol (port) for I/O.
3. Provide concrete implementations in `infrastructure/`.
4. Expose adapters in `adapters/` (HTTP/CLI) that translate external requests into domain inputs and call use-cases.
5. Add unit tests for domain and application; add integration tests for infrastructure with small test assets.

Small illustrative pattern (reader example)
-----------------------------------------
# domain/models.py
from dataclasses import dataclass

@dataclass
class Metadata:
		variable_names: list[str]
		attributes: dict

# application/usecases.py
from typing import Protocol
from ..domain.models import Metadata

class MetadataReader(Protocol):
		def read(self, path: str) -> Metadata: ...

def extract_metadata(path: str, reader: MetadataReader) -> Metadata:
		md = reader.read(path)
		# domain validation or transformations
		return md

# infrastructure/netcdf_reader.py
from ..domain.models import Metadata

class NetCDFReader:
		def read(self, path: str) -> Metadata:
				# use xarray/netCDF4 to read and return domain.Metadata
				...

Testing strategy
----------------
- Unit tests: target `domain/` and `application/` only; mock ports. Fast and deterministic.
- Integration tests: test `infrastructure/` + `adapters/` with small real assets (temporary files, fixtures).
- Test pyramid: many unit tests, fewer integration tests, minimal end-to-end tests.

Tooling & CI recommendations
---------------------------
- Formatting: Black + isort. Linting: ruff/flake8. Type checks: mypy/pyright.
- Testing: prefer the standard library (`unittest`, `doctest`, `unittest.mock`). Use third-party test runners only with explicit justification and PR rationale.
- Packaging: `pyproject.toml` (PEP 621) with Poetry or pip-tools; keep `dependencies` minimal or empty unless runtime packages are justified.
- CI: run format, lint, typecheck, and the stdlib unit tests on PRs; run integration tests on main branch or scheduled runs.

CI / cocompiler test commands (PowerShell)
-----------------------------------------
When running tests in a Windows PowerShell environment (or in CI that emulates it), set the `PYTHONPATH` to the repository `src` directory so imports resolve correctly. The project uses the standard library `unittest` discovery for both unit and integration tests. Example commands to include in your CI job or cocompiler step:

```powershell
$env:PYTHONPATH = 'src'; python -m unittest discover -s tests/unit -p "test_*.py" -v
$env:PYTHONPATH = 'src'; python -m unittest discover -s tests/integration -p "test_*.py" -v
```

Place these commands in the CI job that runs tests. If your CI runner uses bash or another shell, adapt the equivalent `PYTHONPATH=src python -m unittest ...` syntax for that shell.

Dependencies policy
-------------------
- Default: prefer Python standard library for runtime features. Do not add new third-party runtime dependencies unless there is a strong, documented justification.
- If a third-party package is absolutely necessary, prefer small, well-maintained packages available on PyPI and add them explicitly to `pyproject.toml` or `requirements.txt` with a short rationale in the related PR.
- Developer tooling (formatters, linters, type-checkers, test runners) are allowed as dev-dependencies, but should not be shipped as runtime requirements.
- Avoid bringing in heavy, opaque dependencies for simple functionality that can be implemented with the standard library.

Coding guidelines
-----------------
Follow these practical rules for readable, maintainable code across the codebase.

- Style and formatting
	- Use Black formatting and an 88-character line width. Run `isort` for import ordering.
	- Prefer expressive, explicit code over clever one-liners.
	- Use f-strings for string interpolation.

- Naming
	- Modules and packages: short, lowercase, underscore-separated if needed (snake_case).
	- Functions and variables: snake_case.
	- Classes: PascalCase.
	- Constants: UPPER_SNAKE_CASE.

- Types & typing
	- Add type hints for public functions and methods (PEP 484). Prefer `typing` generics over `Any`.
	- Use `dataclasses` for domain models and `typing.Protocol` for interfaces/ports.
	- Run static type checks in CI (mypy or pyright). Keep strictness where practical.

- Docstrings & documentation
	- Document public functions, classes and modules with Google or NumPy style docstrings. Include Args, Returns, and Raises sections for public APIs.
	- Document public functions, classes and modules with Google or NumPy style docstrings. Include Args, Returns, and Raises sections for public APIs.
	- Add short examples when behavior is non-obvious.

	Doctest guidelines
	------------------
	Follow these rules when adding doctest examples in docstrings so they run reliably with `python -m doctest` in CI.

	- Keep examples terse and deterministic
	  - Examples must run without interactive user input and produce the same output on every run.
	  - Avoid printing memory addresses, timestamps, UUIDs, or platform-dependent output. If randomness is required, set a fixed seed inside the example.

	- Importing in examples
	  - Use full imports that will work when the module is executed from the project root. Example:
	    >>> from ncplot7py.domain.models import Metadata

	- Use exact, stable output
	  - Show canonical string or repr output that is stable across Python versions when possible.
	  - For floating-point examples, either round the result in the example or use doctest directives such as `# doctest: +ELLIPSIS` to match approximate output. Example:
	    >>> round(0.1 + 0.2, 6)
	    0.3
	    >>> 0.1 + 0.2  # doctest: +ELLIPSIS
	    0.3000000...

	- Use doctest option flags when needed
	  - Use `# doctest: +ELLIPSIS` to allow partial matching, or `# doctest: +NORMALIZE_WHITESPACE` if whitespace differs.
	  - Avoid overusing flags; prefer making examples precise.

	- Setup and long examples
	  - Keep long examples out of function docstrings; put them in `examples/` or `README.md` and test them separately if needed.
	  - If an example requires setup (creating temp files, sample NetCDF), show only the minimal reproducible snippet in the docstring and add a full integration example in `tests/integration/`.

	- Avoid side effects
	  - Do not perform destructive actions (deleting files, network calls) in doctest examples. If demonstrating I/O, use temporary files within the example or put the full scenario in integration tests.

	- Running doctests in CI
	  - CI should run: `python -m doctest -v src/ncplot7py/*.py` (or a narrower file list). The `pyproject.toml` includes a `doctest-command` showing the canonical command.

	- Example of a good doctest
	  def add(a, b):
	      """
	      Return the sum of two numbers.

	      >>> add(1, 2)
	      3
	      >>> round(add(0.1, 0.2), 6)
	      0.3
	      """
	      return a + b

	- Notes for contributors
	  - Keep doctest examples focused on documenting observable behavior, not internal implementation.
	  - If you add or change doctest examples, run the doctest command locally before opening a PR.

- Imports
	- Use absolute imports within the package (from ncplot7py.xxx import Y).
	- Group imports: stdlib, third-party, local (use isort to enforce).

- Exceptions & error handling
	- Prefer specific exceptions (ValueError, TypeError, etc.). Avoid bare except: clauses.
	- Define domain-specific exception types in `domain/` when callers need to distinguish error classes.
	- Fail fast and validate inputs early. Keep error messages clear and actionable.

- Logging
	- Use the standard `logging` module. Modules should get a logger via `logger = logging.getLogger(__name__)`.
	- Do not use `print()` for production/logging; reserve `print()` only for quick debugging (remove before commit).

- Resource management
	- Use context managers for files, network connections and other resources (`with` statement).
	- Avoid mutable default arguments. Use `None` and set defaults inside the function.

- Concurrency
	- Prefer simple solutions (threading, multiprocessing, asyncio) only when necessary. Encapsulate concurrency in infrastructure layer adapters and keep domain/use-cases synchronous unless the whole stack is async.

	- Tests
		- Follow Arrange-Act-Assert. Keep unit tests fast and deterministic.
		- Use the standard library `unittest` for unit tests (TestCase classes, setUp/tearDown, subTest) and `unittest.mock` for mocking.
		- For table-driven tests, prefer `subTest` or explicit loops inside a TestCase rather than adding test framework dependencies.
		- Use `doctest` for executable examples embedded in docstrings when helpful.
		- For integration tests, use temporary directories (`tempfile.TemporaryDirectory`) and small sample assets. Clean up after tests.

- Commits & PRs
	- Commit message: short title (<=72 chars), optional body with rationale and any migration notes.
	- PR description: explain what changed, why, tests added/updated, and any migration steps for consumers.
	- Keep PRs focused: each PR should implement a single logical change or narrowly related set of changes.

- Code review checklist
	- Does the change respect layer boundaries (domain vs adapters vs infra)?
	- Are side-effects localized to infrastructure/adapters?
	- Are types and docstrings present for public APIs?
	- Are there unit tests for domain/application logic and integration tests for adapters where needed?
	- Is the change small and well-commented (or does it include a rationale in the PR)?

Current project structure
-------------------------
The repository already follows the recommended clean-architecture layout. Use these locations when adding or editing files so Copilot suggestions target the correct layer.

Top-level files
- `LICENSE`, `README.md`, `pyproject.toml`, `dev-requirements.txt`
- `.github/COPILOT_INSTRUCTIONS.md` (this file)

Package layout (src-style)
- `src/ncplot7py/` — main package root
	- `cli/` — CLI entrypoint and command wiring
		- `main.py` — CLI implementation (simulate, plot subcommands)
	- `domain/` — pure domain dataclasses and exceptions
		- `models.py` — NCNode, ToolpathPoint, MachineSpec, SimulationResult
		- `exceptions.py` — domain-specific exception types
	- `application/` — use-cases / orchestrators
		- `simulate.py` — parse -> simulate orchestration utilities
	- `interfaces/` — Protocols / interface definitions
		- `parser.py` — `Parser` Protocol
		- `machine.py` — `MachineDriver` Protocol
		- `plotter.py` — `Plotter` Protocol
		- (intended) `nc_control.py` — NC control Protocol / base class (interface for NC controllers)
	- `infrastructure/` — concrete adapters and implementations (I/O, drivers, plotters)
		- `parsers/gcode_parser.py` — minimal G-code parser (registers as `gcode`)
		- `machines/generic_machine.py` — simple generic machine driver (registers as `generic`)
		- `plotters/matplotlib_plotter.py` — optional matplotlib adapter (registers `matplotlib` plotter)
		- `persistence/` — storage adapters (file-based persistence stubs)
	- `shared/` — small shared helpers and registry
		- `registry.py` — runtime registry resolving parsers/machines/plotters

Tests and examples
- `tests/unit/` — unit tests (e.g. `test_simulate_flow.py`)
- `tests/integration/` — integration tests (parsing+simulate+plot if optional deps installed)
- `examples/` and `data/nc-examples/` — sample NC files and fixtures for integration tests and demos

Notes
- Optional dependencies (plotting) are declared under `pyproject.toml` extras: `plotting = ["matplotlib>=3.0,<4.0"]`.
- Concrete implementations register with the `shared.registry` so CLI and application code can resolve components by name (e.g. parser `gcode`, machine `generic`, plotter `matplotlib`).
- When Copilot generates code that crosses layers, update or create files in the matching package path above.


How Copilot should behave when editing code (updated)
----------------------------------------------------
- When implementing features, prefer stdlib solutions first (os, pathlib, csv, json, tempfile, subprocess, builtins, typing, dataclasses).
- If a suggestion uses a third-party library, add a short justification comment and note that adding a dependency requires an explicit PR description and approval.
- For packages that must be added, include an update to `pyproject.toml` or `requirements.txt` and a brief migration note in the PR description.

How Copilot should behave when editing code
------------------------------------------
- Make minimal, well-scoped edits. If a feature crosses layers, create the smallest set of files required and update tests.
- Prefer adding a Protocol and refactoring callers to depend on it rather than editing many concrete implementations.
- Always include or update unit tests for any domain or application logic changes.

Do / Don't (architecture-focused)
---------------------------------
- Do: keep domain pure, add types and docstrings, add focused unit tests, and include migration notes for breaking changes.
- Don't: put business logic in HTTP handlers, scatter I/O into domain modules, or introduce large runtime deps without justification.

Security
--------
- Never add secrets to the repo. Use environment variables or secrets managers and document required env vars in `.env.example`.

Customization & next steps
--------------------------
This file is a living guideline. To change rules:
- Edit this file and commit.
- Optionally add CI checks to enforce specific rules (typecheck, linter, format).

I can also scaffold starter artifacts if you want:
- `pyproject.toml` + minimal `src/` layout
- Example `MetadataReader` Protocol + `NetCDFReader` implementation + unit/integration tests
- A GitHub Actions workflow that runs Black, ruff/flake8, mypy, and the stdlib tests on PRs





## Error handling (use the structured system)
- Use `ExceptionNode` and `ExceptionTyps` from `ncplot7py.domain.exceptions`.
- Prefer the helper `raise_nc_error(...)` to automatically populate trace and caret when possible.

Example:
```python
from ncplot7py.domain.exceptions import ExceptionTyps, raise_nc_error

if token not in allowed:
    raise_nc_error(
        ExceptionTyps.NCCodeErrors,
        1001,  # see locales XML id "1:1001"
        value=token,
        file=filename,
        line=lineno,
        source_line=line_text,
    )
```

-## Localization of messages
- Message templates are in `src/ncplot7py/locales/{lang}.xml`.
- Keys are `{typ_value}:{code}`. Use placeholders `{value}`, `{line}`, `{code}`, `{typ}`.
- To format for output:
```python
from ncplot7py.domain.i18n import MessageCatalog
text = MessageCatalog().format_exception(exc, lang="en")
```

## Tracing
- Provide `file`, `line`, `source_line` (and `value`) when raising errors to get a caret under the offending token.
- If you know the exact `column`, pass it; otherwise `raise_nc_error` will try to infer it by searching `value` in `source_line`.


-- End of architecture-focused Copilot instructions --
