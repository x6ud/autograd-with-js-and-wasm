let idCount = 0;

export default class Texture {
    readonly id: number = idCount++;
    glTexture?: WebGLTexture;
    width: number;
    height: number;
    flipY: boolean = false;
    image?: HTMLImageElement;

    constructor(texture: WebGLTexture, width: number, height: number) {
        this.glTexture = texture;
        this.width = width;
        this.height = height;
    }
}
