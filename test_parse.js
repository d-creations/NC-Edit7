const text = O1000
G0 X0
M30
<
O2000
G0 Y0
M30;

let result = text;
let isMultiProgram = text.includes('<');
if (isMultiProgram) {
    result = result.replace(/&F=.*/g, '');
    result = result.replace(/%/g, '');
    let ret = [];
    let programs = result.split('<');
    if (programs[0].trim() === '') programs.shift();
    
    for (let i = 0; i < programs.length; i++) {
        if (i > 2) break;
        let programLines = programs[i].split('\n');
        let header = programLines[0];
        let endNameIndex = header.indexOf('.');
        if (endNameIndex === -1) endNameIndex = header.length - 1;
        let programNameS = header.substring(0, endNameIndex).replace('<', '');
        programNameS = programNameS.replace(/\..*\./, '');
        let contentBody = programs[i].replace(/.*>/, '');
        ret.push(programNameS + contentBody);
    }
    console.log(ret);
}
