import Texture from './Texture';

export default class FrameBuffer {

    glFrameBuffer?: WebGLFramebuffer;
    texture: Texture;

    constructor(glFrameBuffer: WebGLFramebuffer, texture: Texture) {
        this.glFrameBuffer = glFrameBuffer;
        this.texture = texture;
    }

}