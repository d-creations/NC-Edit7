class Errors extends Error {
    constructor(val) {
        super(`Element not Found check HTML: ${val}`);
    }
}
