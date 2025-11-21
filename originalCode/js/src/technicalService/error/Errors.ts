

class Errors extends Error {
    constructor(val: string) {
        super(`Element not Found check HTML: ${val}`);
    }
}