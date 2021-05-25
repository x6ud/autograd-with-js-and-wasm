import defaultFrag from './default.frag';
import defaultVert from './default.vert';
import FrameBuffer from './FrameBuffer';
import getUniformSetter from './get-uniform-setter';
import pureFrag from './pure.frag';
import pureVert from './pure.vert';
import Shader from './Shader';
import Texture from './Texture';

enum RenderType {
    MESH, LINES
}

enum BlendMode {
    DEFAULT, LIGHT, PIGMENT
}

interface RendererState {
    width: number;
    height: number;
    color: { r: number, g: number, b: number, a: number };
    cameraX: number;
    cameraY: number;
    zoom: number;
    blendMode: BlendMode;
}

export default class Renderer {
    private static readonly A_POSITION_NAME = 'a_position';
    private static readonly A_TEX_COORD_NAME = 'a_texCoord';
    private static readonly A_COLOR_NAME = 'a_color';
    private static readonly U_TEXTURE_NAME = 'u_texture';

    readonly BLEND_MODE_DEFAULT = BlendMode.DEFAULT;
    readonly BLEND_MODE_LIGHT = BlendMode.LIGHT;
    readonly BLEND_MODE_PIGMENT = BlendMode.PIGMENT;

    readonly gl: WebGLRenderingContext;
    readonly canvas: HTMLCanvasElement;

    /**
     * An 1x1 0xfff pixel.
     */
    readonly BLANK_WHITE: Texture;

    private readonly defaultShader: Shader;
    private readonly pureShader: Shader;

    private readonly batchSize: number;
    private readonly positionVertices: Float32Array;
    private readonly texCoordVertices: Float32Array;
    private readonly vertexColors: Float32Array;
    private readonly positionVerticesBuffer: WebGLBuffer;
    private readonly texCoordVerticesBuffer: WebGLBuffer;
    private readonly vertexColorsBuffer: WebGLBuffer;

    private readonly frameBufferStack: FrameBuffer[] = [];

    state: RendererState = {
        width: 0,
        height: 0,
        color: {r: 1, g: 1, b: 1, a: 1},
        cameraX: 0,
        cameraY: 0,
        zoom: 1,
        blendMode: BlendMode.DEFAULT
    };
    private stateStack: RendererState[] = [];

    private currentShader: Shader;
    private uniforms: { [name: string]: any } = {};
    private currentTexture?: Texture;
    private currentIndex: number = 0;
    private currentFrameBuffer?: FrameBuffer;
    private renderType: RenderType = RenderType.MESH;

    constructor(canvas?: HTMLCanvasElement, batchSize: number = 2000) {
        if (!canvas) {
            canvas = document.createElement('canvas');
        }
        canvas.style.background = 'none';
        this.canvas = canvas;
        this.state.width = canvas.width;
        this.state.height = canvas.height;

        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: false,
            depth: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            stencil: false
        });
        if (!gl) {
            throw new Error('Failed to create WebGL context');
        }
        this.gl = gl;
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        this.setBlendMode(BlendMode.PIGMENT);

        this.defaultShader = this.createShader();
        this.pureShader = this.createShader(pureVert, pureFrag);
        this.currentShader = this.defaultShader;

        this.batchSize = batchSize;
        this.positionVertices = new Float32Array(batchSize * 3 * 2 * 2);
        this.texCoordVertices = new Float32Array(batchSize * 3 * 2 * 2);
        this.vertexColors = new Float32Array(batchSize * 3 * 2 * 4);

        const positionVerticesBuffer = gl.createBuffer();
        if (!positionVerticesBuffer) {
            throw new Error('Failed to create buffer');
        }
        this.positionVerticesBuffer = positionVerticesBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, positionVerticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positionVertices, gl.DYNAMIC_DRAW);

        const texCoordVerticesBuffer = gl.createBuffer();
        if (!texCoordVerticesBuffer) {
            throw new Error('Failed to create buffer');
        }
        this.texCoordVerticesBuffer = texCoordVerticesBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordVerticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.texCoordVertices, gl.DYNAMIC_DRAW);

        const vertexColorsBuffer = gl.createBuffer();
        if (!vertexColorsBuffer) {
            throw new Error('Failed to create buffer');
        }
        this.vertexColorsBuffer = vertexColorsBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertexColors, gl.DYNAMIC_DRAW);

        this.BLANK_WHITE = this.createTextureFromRgbaPixels(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 1, 1);
    }

    resizeCanvas(width: number, height: number) {
        if (width < 0 || height < 0) {
            throw new Error('Negative width/height');
        }
        if (width !== this.canvas.width || height !== this.canvas.height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        this.resize(width, height);
    }

    resize(width: number, height: number, centerCamera: boolean = false) {
        if (width === this.state.width && height === this.state.width) {
            if (centerCamera) {
                this.centerCamera();
            }
            return;
        }
        this.state.width = width;
        this.state.height = height;
        if (centerCamera) {
            this.centerCamera();
        }
        const gl = this.gl;
        gl.viewport(0, 0, width, height);
    }

    setCameraPosition(x: number, y: number) {
        this.state.cameraX = x;
        this.state.cameraY = y;
    }

    centerCamera() {
        this.setCameraPosition(this.state.width / 2, this.state.height / 2);
    }

    setZoom(zoom: number) {
        this.state.zoom = zoom;
    }

    setColor(r: number, g: number, b: number, a: number = 1) {
        this.state.color.r = r;
        this.state.color.g = g;
        this.state.color.b = b;
        this.state.color.a = a;
    }

    save() {
        const state = this.state;
        const color = state.color;
        this.stateStack.push({
            width: state.width,
            height: state.height,
            color: {r: color.r, g: color.g, b: color.b, a: color.a},
            cameraX: state.cameraX,
            cameraY: state.cameraY,
            zoom: state.zoom,
            blendMode: state.blendMode
        });
    }

    restore() {
        const state = this.stateStack.pop();
        if (!state) {
            throw new Error('State stack is empty');
        }
        this.state.color.r = state.color.r;
        this.state.color.g = state.color.g;
        this.state.color.b = state.color.b;
        this.state.color.a = state.color.a;
        this.state.cameraX = state.cameraX;
        this.state.cameraY = state.cameraY;
        this.state.zoom = state.zoom;
        this.resize(state.width, state.height);
        this.setBlendMode(state.blendMode);
    }

    setBlendMode(blendMode: BlendMode) {
        if (blendMode === this.state.blendMode) {
            return;
        }
        this.state.blendMode = blendMode;
        this.flush();
        const gl = this.gl;
        switch (blendMode) {
            case BlendMode.DEFAULT:
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFunc(gl.ONE, gl.ZERO);
                break;
            case BlendMode.LIGHT:
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                break;
            case BlendMode.PIGMENT: {
                const ext = gl.getExtension('EXT_blend_minmax');
                if (ext) {
                    gl.blendEquationSeparate(gl.FUNC_ADD, ext.MAX_EXT);
                }
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
                break;
        }
    }

    copyTo(
        ctx: CanvasRenderingContext2D,
        dx: number = 0,
        dy: number = 0,
        dw: number = this.state.width,
        dh: number = this.state.height,
        sx: number = 0,
        sy: number = 0,
        sw: number = this.state.width,
        sh: number = this.state.height
    ) {
        ctx.drawImage(this.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    clear(r: number = 0, g: number = 0, b: number = 0, a: number = 0) {
        this.switchFrameBuffer();
        const gl = this.gl;
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    setUniforms(uniforms?: { [name: string]: any }) {
        this.uniforms = uniforms || {};
    }

    // ====================== draw ======================

    flush() {
        switch (this.renderType) {
            case RenderType.MESH:
                this.flushMesh();
                break;
            case RenderType.LINES:
                this.flushLines();
                break;
        }
    }

    private flushMesh() {
        if (this.currentIndex === 0) {
            return;
        }
        const texture = this.currentTexture;
        if (!texture) {
            return;
        }
        if (!texture.glTexture) {
            throw new Error('Texture has been deleted');
        }

        const len = this.currentIndex;
        this.currentIndex = 0;

        const gl = this.gl;
        const shader = this.currentShader;
        if (!shader.program) {
            throw new Error('Shader has been deleted');
        }
        gl.useProgram(shader.program);

        // position
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionVerticesBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positionVertices);
        const positionLocation = shader.attributes[Renderer.A_POSITION_NAME].location;
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // tex-coord
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordVerticesBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.texCoordVertices);
        const texCoordLocation = shader.attributes[Renderer.A_TEX_COORD_NAME].location;
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // color
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorsBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexColors);
        const colorLocation = shader.attributes[Renderer.A_COLOR_NAME].location;
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

        // texture
        shader.uniforms[Renderer.U_TEXTURE_NAME]?.setter(texture.glTexture);

        // uniforms
        Object.keys(this.uniforms).forEach(name => {
            if (shader.uniforms.hasOwnProperty(name)) {
                shader.uniforms[name].setter(this.uniforms[name]);
            }
        });

        // draw
        this.switchFrameBuffer();
        gl.drawArrays(gl.TRIANGLES, 0, len * 6);
    }

    private flushLines() {
        if (this.currentIndex === 0) {
            return;
        }

        const len = this.currentIndex;
        this.currentIndex = 0;

        const gl = this.gl;
        const shader = this.pureShader;
        if (!shader.program) {
            throw new Error('Shader has been deleted');
        }
        gl.useProgram(shader.program);

        // position
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionVerticesBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positionVertices);
        const positionLocation = shader.attributes[Renderer.A_POSITION_NAME].location;
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // color
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorsBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexColors);
        const colorLocation = shader.attributes[Renderer.A_COLOR_NAME].location;
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

        // draw
        this.switchFrameBuffer();
        gl.drawArrays(gl.LINES, 0, len * 2);
    }

    drawLine(x0: number, y0: number, x1: number, y1: number) {
        if (
            this.currentIndex >= this.batchSize * 3
            || this.renderType !== RenderType.LINES
        ) {
            this.flush();
        }
        this.renderType = RenderType.LINES;

        const zoom = this.state.zoom;
        const invW = 2 / this.state.width * zoom;
        const invH = 2 / this.state.height * zoom;
        const cameraX = this.state.cameraX;
        const cameraY = this.state.cameraY;

        const positionVertices = this.positionVertices;
        const index = this.currentIndex * 2 * 2;
        positionVertices[index] = (x0 - cameraX) * invW;
        positionVertices[index + 1] = (y0 - cameraY) * invH;
        positionVertices[index + 2] = (x1 - cameraX) * invW;
        positionVertices[index + 3] = (y1 - cameraY) * invH;

        const colorIndex = this.currentIndex * 2 * 4;
        const vertexColors = this.vertexColors;
        const color = this.state.color;
        for (let i = 0; i < 2; ++i) {
            const offset = i * 4;
            vertexColors[colorIndex + offset] = color.r;
            vertexColors[colorIndex + 1 + offset] = color.g;
            vertexColors[colorIndex + 2 + offset] = color.b;
            vertexColors[colorIndex + 3 + offset] = color.a;
        }

        this.currentIndex += 1;
    }

    private internalPushCwQuadVertices(
        texture: Texture,
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        texX0: number,
        texY0: number,
        texX1: number,
        texY1: number,
        texX2: number,
        texY2: number,
        texX3: number,
        texY3: number
    ) {
        if (
            this.currentIndex >= this.batchSize
            || texture !== this.currentTexture
            || this.renderType !== RenderType.MESH
        ) {
            this.flush();
        }
        this.renderType = RenderType.MESH;

        this.currentTexture = texture;
        const index = this.currentIndex * 3 * 2 * 2;
        const positionVertices = this.positionVertices;
        const texCoordVertices = this.texCoordVertices;

        positionVertices[index] = x0;
        positionVertices[index + 1] = y0;
        positionVertices[index + 2] = x1;
        positionVertices[index + 3] = y1;
        positionVertices[index + 4] = x3;
        positionVertices[index + 5] = y3;

        positionVertices[index + 6] = x1;
        positionVertices[index + 7] = y1;
        positionVertices[index + 8] = x2;
        positionVertices[index + 9] = y2;
        positionVertices[index + 10] = x3;
        positionVertices[index + 11] = y3;

        if (texture.flipY) {
            [texX0, texY0, texX3, texY3] = [texX3, texY3, texX0, texY0];
            [texX1, texY1, texX2, texY2] = [texX2, texY2, texX1, texY1];
        }

        texCoordVertices[index] = texX0;
        texCoordVertices[index + 1] = texY0;
        texCoordVertices[index + 2] = texX1;
        texCoordVertices[index + 3] = texY1;
        texCoordVertices[index + 4] = texX3;
        texCoordVertices[index + 5] = texY3;

        texCoordVertices[index + 6] = texX1;
        texCoordVertices[index + 7] = texY1;
        texCoordVertices[index + 8] = texX2;
        texCoordVertices[index + 9] = texY2;
        texCoordVertices[index + 10] = texX3;
        texCoordVertices[index + 11] = texY3;

        const colorIndex = this.currentIndex * 3 * 2 * 4;
        const vertexColors = this.vertexColors;
        const color = this.state.color;
        for (let i = 0; i < 2 * 3; ++i) {
            const offset = i * 4;
            vertexColors[colorIndex + offset] = color.r;
            vertexColors[colorIndex + 1 + offset] = color.g;
            vertexColors[colorIndex + 2 + offset] = color.b;
            vertexColors[colorIndex + 3 + offset] = color.a;
        }
        this.currentIndex += 1;
    }

    drawCwQuad(
        texture: Texture,
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        texX0: number = 0,
        texY0: number = texture.height,
        texX1: number = texture.width,
        texY1: number = texture.height,
        texX2: number = texture.width,
        texY2: number = 0,
        texX3: number = 0,
        texY3: number = 0
    ) {
        const zoom = this.state.zoom;
        const invW = 2 / this.state.width * zoom;
        const invH = 2 / this.state.height * zoom;
        const invSW = 1 / texture.width;
        const invSH = 1 / texture.height;
        const cameraX = this.state.cameraX;
        const cameraY = this.state.cameraY;
        this.internalPushCwQuadVertices(
            texture,
            (x0 - cameraX) * invW,
            (y0 - cameraY) * invH,
            (x1 - cameraX) * invW,
            (y1 - cameraY) * invH,
            (x2 - cameraX) * invW,
            (y2 - cameraY) * invH,
            (x3 - cameraX) * invW,
            (y3 - cameraY) * invH,
            texX0 * invSW,
            texY0 * invSH,
            texX1 * invSW,
            texY1 * invSH,
            texX2 * invSW,
            texY2 * invSH,
            texX3 * invSW,
            texY3 * invSH
        );
    }

    drawRect(
        texture: Texture,
        dx: number = 0,
        dy: number = 0,
        dw: number = texture.width,
        dh: number = texture.height,
        flipX: boolean = false,
        flipY: boolean = false,
        sx: number = 0,
        sy: number = 0,
        sw: number = texture.width,
        sh: number = texture.height
    ) {
        const dstLeft = dx;
        const dstRight = dx + dw;
        const dstTop = dy + dh;
        const dstBottom = dy;
        let texLeft = sx;
        let texRight = sx + sw;
        let texTop = sy;
        let texBottom = sy + sh;
        if (flipX) {
            [texLeft, texRight] = [texRight, texLeft];
        }
        if (flipY) {
            [texTop, texBottom] = [texBottom, texTop];
        }
        this.drawCwQuad(
            texture,
            dstLeft,
            dstBottom,
            dstRight,
            dstBottom,
            dstRight,
            dstTop,
            dstLeft,
            dstTop,
            texLeft,
            texBottom,
            texRight,
            texBottom,
            texRight,
            texTop,
            texLeft,
            texTop
        );
    }

    draw(
        texture: Texture,
        dstX: number = 0,
        dstY: number = 0,
        dstW: number = texture.width,
        dstH: number = texture.height,
        flipX: boolean = false,
        flipY: boolean = false,
        srcX: number = 0,
        srcY: number = 0,
        srcW: number = texture.width,
        srcH: number = texture.height,
        dx: number = 0,
        dy: number = 0,
        ox: number = 0,
        oy: number = 0,
        rotation: number = 0,
        sx: number = 1,
        sy: number = 1
    ) {
        const left = dstX;
        const right = dstX + dstW;
        const top = dstY + dstH;
        const bottom = dstY;

        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);

        const m11 = cosR * sx;
        const m12 = -sinR * sy;
        const m13 = -cosR * ox * sx + dx + ox + oy * sinR * sy;
        const m21 = sinR * sx;
        const m22 = cosR * sy;
        const m23 = -cosR * oy * sy + dy - ox * sinR * sx + oy;

        const v0x = left;
        const v0y = bottom;
        const v1x = right;
        const v1y = bottom;
        const v2x = right;
        const v2y = top;
        const v3x = left;
        const v3y = top;

        let texLeft = srcX;
        let texRight = srcX + srcW;
        let texTop = srcY;
        let texBottom = srcY + srcH;
        if (flipX) {
            [texLeft, texRight] = [texRight, texLeft];
        }
        if (flipY) {
            [texTop, texBottom] = [texBottom, texTop];
        }

        this.drawCwQuad(
            texture,
            m11 * v0x + m12 * v0y + m13,
            m21 * v0x + m22 * v0y + m23,
            m11 * v1x + m12 * v1y + m13,
            m21 * v1x + m22 * v1y + m23,
            m11 * v2x + m12 * v2y + m13,
            m21 * v2x + m22 * v2y + m23,
            m11 * v3x + m12 * v3y + m13,
            m21 * v3x + m22 * v3y + m23,
            texLeft,
            texBottom,
            texRight,
            texBottom,
            texRight,
            texTop,
            texLeft,
            texTop
        );
    }

    // ====================== texture ======================

    createEmptyTexture(width: number, height: number): Texture {
        if (width < 0 || height < 0) {
            throw new Error('Negative width/height');
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error('Failed to create WebGL texture');
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        return new Texture(texture, width, height);
    }

    createTexture(image: TexImageSource): Texture {
        const texture = this.createEmptyTexture(image.width, image.height);
        const gl = this.gl;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        return texture;
    }

    createTextureFromImageUrl(url: string): Promise<Texture> {
        return new Promise((resolve, reject) => {
            try {
                const image = new Image();
                image.onload = () => {
                    try {
                        const texture = this.createTexture(image);
                        texture.image = image;
                        resolve(texture);
                    } catch (e) {
                        reject(e);
                    }
                };
                image.onabort = image.onerror = (e: string | Event) => {
                    reject(e);
                };
                image.src = url;
            } catch (e) {
                reject(e);
            }
        });
    }

    createTextureFromRgbaPixels(pixels: ArrayBufferView, width: number, height: number) {
        const texture = this.createEmptyTexture(width, height);
        const gl = this.gl;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return texture;
    }

    setTextureFromRgbaPixels(texture: Texture, pixels: ArrayBufferView, width: number, height: number) {
        const gl = this.gl;
        if (!texture.glTexture) {
            throw new Error('Texture has been deleted');
        }
        gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        texture.width = width;
        texture.height = height;
    }

    deleteTexture(texture: Texture) {
        if (texture.glTexture) {
            this.gl.deleteTexture(texture.glTexture);
            texture.glTexture = undefined;
        }
        texture.width = 0;
        texture.height = 0;
    }

    resizeTexture(texture: Texture, width: number, height: number) {
        if (width < 0 || height < 0) {
            throw new Error('Negative width/height');
        }
        if (texture.width === width && texture.height === height) {
            return;
        }
        const gl = this.gl;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        texture.width = width;
        texture.height = height;
    }

    // ====================== shader ======================

    private createGlShader(src: string, type: GLenum): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error('Failed to create WebGL shader');
        }
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Failed to compile WebGL shader:\n\n' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    createShader(vertSrc: string = defaultVert, fragSrc: string = defaultFrag): Shader {
        const gl = this.gl;
        const vertShader = this.createGlShader(vertSrc, gl.VERTEX_SHADER);
        const fragShader = this.createGlShader(fragSrc, gl.FRAGMENT_SHADER);
        const program = gl.createProgram();
        if (!program) {
            throw new Error('Failed to create WebGL program');
        }
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Failed to link WebGL program:\n\n' + gl.getProgramInfoLog(program));
        }

        const shader = new Shader(vertShader, fragShader, program);

        const numOfAttrs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numOfAttrs; ++i) {
            const info = gl.getActiveAttrib(program, i);
            if (!info) {
                throw new Error('Failed to get WebGL attribute info');
            }
            const location = gl.getAttribLocation(program, info.name);
            shader.registerAttribute(info.name, info.size, info.type, location);
        }

        const numOfUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        const samplerCounter = {count: 0};
        for (let i = 0; i < numOfUniforms; ++i) {
            const info = gl.getActiveUniform(program, i);
            if (!info) {
                throw new Error('Failed to get WebGL uniform info');
            }
            const location = gl.getUniformLocation(program, info.name);
            if (location == null) {
                throw new Error('Failed to get uniform location');
            }
            shader.registerUniform(
                info.name,
                info.size,
                info.type,
                location,
                getUniformSetter(gl, info.name, info.size, info.type, location, samplerCounter)
            );
        }

        return shader;
    }

    deleteShader(shader: Shader) {
        const gl = this.gl;
        if (shader.program) {
            gl.deleteProgram(shader.program);
            shader.program = undefined;
        }
        if (shader.vertShader) {
            gl.deleteShader(shader.vertShader);
            shader.vertShader = undefined;
        }
        if (shader.fragShader) {
            gl.deleteShader(shader.fragShader);
            shader.fragShader = undefined;
        }
        shader.uniforms = {};
        shader.attributes = {};
    }

    useShader(shader: Shader = this.defaultShader) {
        if (shader === this.currentShader) {
            return;
        }
        this.currentShader = shader;
        this.uniforms = {};
        this.flush();
    }

    // ====================== frame buffer ======================

    createFrameBuffer(texture?: Texture) {
        const gl = this.gl;
        const frameBuffer = gl.createFramebuffer();
        if (!frameBuffer) {
            throw new Error('Failed to create WebGL frame buffer');
        }
        texture = texture || this.createEmptyTexture(this.state.width, this.state.height);
        texture.flipY = true;
        if (!texture.glTexture) {
            throw new Error('Texture has been deleted');
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.glTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return new FrameBuffer(frameBuffer, texture);
    }

    deleteFrameBuffer(frameBuffer: FrameBuffer) {
        if (frameBuffer.glFrameBuffer) {
            this.gl.deleteFramebuffer(frameBuffer.glFrameBuffer);
            frameBuffer.glFrameBuffer = undefined;
        }
    }

    private switchFrameBuffer() {
        const stack = this.frameBufferStack;
        const frameBuffer = stack.length ? stack[stack.length - 1] : undefined;
        if (frameBuffer !== this.currentFrameBuffer) {
            this.currentFrameBuffer = frameBuffer;
            if (frameBuffer) {
                this.resizeTexture(frameBuffer.texture, this.state.width, this.state.height);
            }
            const gl = this.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer && frameBuffer.glFrameBuffer || null);
        }
    }

    startCapture(frameBuffer: FrameBuffer) {
        this.flush();
        this.frameBufferStack.push(frameBuffer);
    }

    endCapture() {
        this.flush();
        this.frameBufferStack.pop();
    }

}
