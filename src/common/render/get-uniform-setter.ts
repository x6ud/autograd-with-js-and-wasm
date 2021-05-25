import Texture from './Texture';

export default function getUniformSetter(
    gl: WebGLRenderingContext,
    name: string,
    size: GLint,
    type: GLenum,
    location: WebGLUniformLocation,
    samplerCounter: { count: number }
): (val: any) => void {
    if (name.substr(-3) === '[0]') {
        throw new Error(`Unimplemented setter type (uniform: ${name}, type: ${type})`);
    }
    switch (type) {
        case gl.FLOAT:
            return function (val: GLfloat) {
                gl.uniform1f(location, val);
            };
        case gl.FLOAT_VEC2:
            return function (val: Float32List) {
                gl.uniform2fv(location, val);
            };
        case gl.FLOAT_VEC3:
            return function (val: Float32List) {
                gl.uniform3fv(location, val);
            };
        case gl.FLOAT_VEC4:
            return function (val: Float32List) {
                gl.uniform4fv(location, val);
            };
        case gl.BOOL:
        case gl.INT:
            return function (val: GLint) {
                gl.uniform1i(location, val);
            };
        case gl.BOOL_VEC2:
        case gl.INT_VEC2:
            return function (val: Int32List) {
                gl.uniform2iv(location, val);
            };
        case gl.BOOL_VEC3:
        case gl.INT_VEC3:
            return function (val: Int32List) {
                gl.uniform3iv(location, val);
            };
        case gl.BOOL_VEC4:
        case gl.INT_VEC4:
            return function (val: Int32List) {
                gl.uniform4iv(location, val);
            };
        case gl.FLOAT_MAT2:
            return function (val: Float32List) {
                gl.uniformMatrix2fv(location, false, val);
            };
        case gl.FLOAT_MAT3:
            return function (val: Float32List) {
                gl.uniformMatrix3fv(location, false, val);
            };
        case gl.FLOAT_MAT4:
            return function (val: Float32List) {
                gl.uniformMatrix4fv(location, false, val);
            };
        case gl.SAMPLER_2D:
            const ii = samplerCounter.count++;
            return function (val: WebGLTexture | Texture) {
                if (val instanceof Texture && val.glTexture) {
                    val = val.glTexture;
                }
                gl.uniform1i(location, ii);
                gl.activeTexture(gl.TEXTURE0 + ii);
                gl.bindTexture(gl.TEXTURE_2D, val as WebGLTexture);
            };
        default:
            throw new Error(`Unimplemented setter type (uniform: ${name}, type: ${type})`);
    }
}