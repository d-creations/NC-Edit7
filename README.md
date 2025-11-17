# NC-Edit7
CNC NC code editor view with plot interface. 

The editor integrates the ACE text editor and enables the plotting of toolpaths with the three.js library

It is currently developed as a gui for an nc-code plot 

The project is still awaiting its first release, 
but a beta view is already available

### beta view
you will find a beta view under https://www.star-ncplot.com


<img src="./image.png" width="200px">

## Local build

To rebuild the TypeScript source, install the tooling and run the clean/build scripts:

```bash
npm install
npm run clean
npm run build
```

The build emits compiled files under `dist` and relies solely on Node 16+ native APIs (no `rimraf`).

## Testing

Phase 2 tests verify the parser and state services using Node's built-in test runner. They rely on the up-to-date `dist` output, so run them via:

```bash
npm run test
```

This script rebuilds the project and then executes `node --test test/parser.service.test.js test/state.service.test.js`, which loads those files from the `test` directory and reports any failures from the services under test.
