declare module '*.vue' {
    // @ts-ignore
    import {Component} from '@vue/runtime-core';
    const content: Component;
    export default content;
}

declare module '*.png' {
    const content: string;
    export default content;
}

declare module '*.jpg' {
    const content: string;
    export default content;
}

declare module '*.vert' {
    const content: string;
    export default content;
}

declare module '*.frag' {
    const content: string;
    export default content;
}

declare module '*.wasm' {
    const content: ArrayBuffer;
    export default content;
}
