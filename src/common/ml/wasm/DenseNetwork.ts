import assemblyScriptLoader from '@assemblyscript/loader';

enum LayerType {
    LINEAR = 1,
    RE_LU = 2,
    TANH = 3,
    SOFTMAX = 4
}

export type LayerDef =
    { type: LayerType.LINEAR, size: number }
    | { type: LayerType.RE_LU }
    | { type: LayerType.TANH }
    | { type: LayerType.SOFTMAX };

const PAGE_SIZE = 0xffff;
const U32_BYTES = 4;
const F64_BYTES = 8;

type DenseModule = {
    forward(headerSize: number, networkOffset: number): void;
    zeroGrad(headerSize: number, networkOffset: number): void;
    backward(headerSize: number, networkOffset: number, networkSize: number): void;
    optimizerZeroGrad(optimizerDataOffset: number, numOfParameters: number): void;
    accumulateParameterGrads(headerSize: number, networkOffset: number, optimizerDataOffset: number): void;
    updateParameters(
        headerSize: number,
        networkOffset: number,
        optimizerDataOffset: number,
        beta1: number,
        beta2: number,
        lr: number,
        batchSize: number,
        epoch: number,
        epsilon: number
    ): void;
};

export default class DenseNetwork {

    static linear(size: number): LayerDef {
        return {type: LayerType.LINEAR, size};
    }

    static reLU(): LayerDef {
        return {type: LayerType.RE_LU};
    }

    static tanh(): LayerDef {
        return {type: LayerType.TANH};
    }

    static softmax(): LayerDef {
        return {type: LayerType.SOFTMAX};
    }

    networkDef?: {
        inputs: number;
        layers: LayerDef[];
    };
    headerSize: number = 0;
    networkOffset: number = 0;
    networkSize: number = 0;
    outputSize: number = 0;
    numOfParameters: number = 0;
    optimizerDataOffset: number = 0;
    epoch: number = 1;
    instance?: WebAssembly.Instance;
    memory?: WebAssembly.Memory;

    async init() {
        if (this.instance) {
            throw new Error('Already initialized.');
        }
        this.memory = new WebAssembly.Memory({initial: 1});
        const source: ArrayBuffer = (await import('./dense.wasm')).default;
        const instantiatedSource = await assemblyScriptLoader.instantiate(source, {
            env: {memory: this.memory}
        });
        this.instance = instantiatedSource.instance;
    }

    defNetwork(inputs: number, layers: LayerDef[]) {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }

        this.networkDef = {inputs, layers};

        let prevLayerSize = inputs;
        let headerSize = 2;
        let networkSize = inputs * 2; // {[input][input_grad]}*inputs
        let numOfParameters = 0;
        layers.forEach(layerDef => {
            switch (layerDef.type) {
                case LayerType.LINEAR:
                    headerSize += 2;
                    const neuronSize = prevLayerSize * 2 + 2; // {{[w][w_grad]}*inputSize, [b][b_grad]}
                    networkSize += neuronSize * layerDef.size + layerDef.size * 2; // {parameters, {[out][out_grad]}*layerSize}
                    numOfParameters += (prevLayerSize + 1) * layerDef.size;
                    prevLayerSize = layerDef.size;
                    break;
                default:
                    headerSize += 2;
                    networkSize += prevLayerSize * 2; // {[out][out_grad]}*layerSize
                    break;
            }
        });

        this.headerSize = headerSize;
        this.networkOffset = Math.ceil(headerSize * U32_BYTES / F64_BYTES);
        this.networkSize = networkSize;
        this.outputSize = prevLayerSize;
        this.numOfParameters = numOfParameters;
        this.optimizerDataOffset = this.networkOffset + networkSize;
        const optimizerDataSize = numOfParameters * 3; // {[gradSum][m][v]}*numOfParameters

        const bytes = this.networkOffset * F64_BYTES + networkSize * F64_BYTES + optimizerDataSize * F64_BYTES;
        const memorySize = ((bytes + PAGE_SIZE) & (~PAGE_SIZE)) >>> 16;
        const currMemorySize = this.memory.buffer.byteLength >>> 16;
        if (memorySize > currMemorySize) {
            this.memory.grow(memorySize - currMemorySize);
        }

        const header = new Uint32Array(this.memory.buffer, 0, headerSize);
        header[0] = 0;
        header[1] = inputs;
        let headerOffset = 2;
        let layerSize = inputs;
        layers.forEach(layerDef => {
            switch (layerDef.type) {
                case LayerType.LINEAR:
                    header[headerOffset] = layerDef.type;
                    header[headerOffset + 1] = layerDef.size;
                    layerSize = layerDef.size;
                    headerOffset += 2;
                    break;
                default:
                    header[headerOffset] = layerDef.type;
                    header[headerOffset + 1] = layerSize;
                    headerOffset += 2;
                    break;
            }
        });
    }

    getNetworkBuffer() {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }
        return new Float64Array(this.memory.buffer, this.networkOffset * F64_BYTES, this.networkSize);
    }

    randomInitParameters() {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const buffer = this.getNetworkBuffer();
        let prevLayerSize = this.networkDef.inputs;
        const layers = this.networkDef.layers;
        let networkOffset = this.networkDef.inputs * 2;
        for (let layerIndex = 0, layersNum = layers.length; layerIndex < layersNum; ++layerIndex) {
            const layerDef = layers[layerIndex];
            switch (layerDef.type) {
                case LayerType.LINEAR:
                    const layerSize = layerDef.size;
                    const neuronSize = prevLayerSize * 2 + 2;
                    for (let neuronIndex = 0; neuronIndex < layerSize; ++neuronIndex) {
                        const neuronOffset = networkOffset + neuronSize * neuronIndex;
                        for (let i = 0; i < prevLayerSize; ++i) {
                            buffer[neuronOffset + i * 2] = Math.random() * 2 - 1;
                        }
                        buffer[neuronOffset + prevLayerSize * 2] = Math.random() * 2 - 1;
                    }
                    prevLayerSize = layerSize;
                    networkOffset += neuronSize * layerSize + layerSize * 2;
                    break;
                case LayerType.RE_LU:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.TANH:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.SOFTMAX:
                    networkOffset += prevLayerSize * 2;
                    break;
            }
        }
        return this;
    }

    setParameters(parameters: ArrayLike<number>) {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const buffer = this.getNetworkBuffer();
        let prevLayerSize = this.networkDef.inputs;
        const layers = this.networkDef.layers;
        let networkOffset = this.networkDef.inputs * 2;
        let parameterIndex = 0;
        for (let layerIndex = 0, layersNum = layers.length; layerIndex < layersNum; ++layerIndex) {
            const layerDef = layers[layerIndex];
            switch (layerDef.type) {
                case LayerType.LINEAR:
                    const layerSize = layerDef.size;
                    const neuronSize = prevLayerSize * 2 + 2;
                    for (let neuronIndex = 0; neuronIndex < layerSize; ++neuronIndex) {
                        const neuronOffset = networkOffset + neuronSize * neuronIndex;
                        for (let i = 0; i < prevLayerSize; ++i) {
                            buffer[neuronOffset + i * 2] = parameters[parameterIndex++];
                        }
                        buffer[neuronOffset + prevLayerSize * 2] = parameters[parameterIndex++];
                    }
                    prevLayerSize = layerSize;
                    networkOffset += neuronSize * layerSize + layerSize * 2;
                    break;
                case LayerType.RE_LU:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.TANH:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.SOFTMAX:
                    networkOffset += prevLayerSize * 2;
                    break;
            }
        }
        return this;
    }

    getParameters() {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const numOfParameters = this.numOfParameters;
        const layers = this.networkDef.layers;
        const ret = new Float64Array(numOfParameters);
        const buffer = this.getNetworkBuffer();
        let prevLayerSize = this.networkDef.inputs;
        let networkOffset = this.networkDef.inputs * 2;
        let parameterIndex = 0;
        for (let layerIndex = 0, layersNum = layers.length; layerIndex < layersNum; ++layerIndex) {
            const layerDef = layers[layerIndex];
            switch (layerDef.type) {
                case LayerType.LINEAR:
                    const layerSize = layerDef.size;
                    const neuronSize = prevLayerSize * 2 + 2;
                    for (let neuronIndex = 0; neuronIndex < layerSize; ++neuronIndex) {
                        const neuronOffset = networkOffset + neuronSize * neuronIndex;
                        for (let i = 0; i < prevLayerSize; ++i) {
                            ret[parameterIndex++] = buffer[neuronOffset + i * 2];
                        }
                        ret[parameterIndex++] = buffer[neuronOffset + prevLayerSize * 2];
                    }
                    prevLayerSize = layerSize;
                    networkOffset += neuronSize * layerSize + layerSize * 2;
                    break;
                case LayerType.RE_LU:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.TANH:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.SOFTMAX:
                    networkOffset += prevLayerSize * 2;
                    break;
            }
        }
        return ret;
    }

    setInputs(inputs: ArrayLike<number>) {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const buffer = this.getNetworkBuffer();
        const inputsLen = this.networkDef.inputs;
        for (let i = 0; i < inputsLen; ++i) {
            buffer[i * 2] = inputs[i];
        }
        return this;
    }

    getOutputs() {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const buffer = this.getNetworkBuffer();
        const outputSize = this.outputSize;
        const outputsOffset = this.networkSize - outputSize * 2;
        const ret = new Float64Array(outputSize);
        for (let i = 0; i < outputSize; ++i) {
            ret[i] = buffer[outputsOffset + i * 2];
        }
        return ret;
    }

    forward() {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }
        (this.instance.exports as DenseModule).forward(this.headerSize, this.networkOffset);
        return this;
    }

    zeroGrad() {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }
        (this.instance.exports as DenseModule).zeroGrad(this.headerSize, this.networkOffset);
        return this;
    }

    backward() {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }
        (this.instance.exports as DenseModule).backward(this.headerSize, this.networkOffset, this.networkSize);
        return this;
    }

    setOutputGrads(grads: ArrayLike<number>) {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const buffer = this.getNetworkBuffer();
        const outputSize = this.outputSize;
        const outputsOffset = this.networkSize - outputSize * 2;
        for (let i = 0; i < outputSize; ++i) {
            buffer[outputsOffset + i * 2 + 1] = grads[i];
        }
        return this;
    }

    getOutputGrads() {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const ret = new Float64Array(this.outputSize);
        const buffer = this.getNetworkBuffer();
        const outputSize = this.outputSize;
        const outputsOffset = this.networkSize - outputSize * 2;
        for (let i = 0; i < outputSize; ++i) {
            ret[i] = buffer[outputsOffset + i * 2 + 1];
        }
        return ret;
    }

    getInputGrads() {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        const ret = new Float64Array(this.networkDef.inputs);
        const buffer = this.getNetworkBuffer();
        const inputsLen = this.networkDef.inputs;
        for (let i = 0; i < inputsLen; ++i) {
            ret[i] = buffer[i * 2 + 1];
        }
        return ret;
    }

    getParameterGrads() {
        if (!this.networkDef) {
            throw new Error('Network not defined.');
        }
        let numOfParameters = 0;
        let prevLayerSize = this.networkDef.inputs;
        const layers = this.networkDef.layers;
        for (let layerIndex = 0, layersNum = layers.length; layerIndex < layersNum; ++layerIndex) {
            const layerDef = layers[layerIndex];
            switch (layerDef.type) {
                case LayerType.LINEAR:
                    const layerSize = layerDef.size;
                    numOfParameters += (prevLayerSize + 1) * layerSize;
                    prevLayerSize = layerSize;
                    break;
                default:
                    break;
            }
        }
        const ret = new Float64Array(numOfParameters);
        const buffer = this.getNetworkBuffer();
        let networkOffset = this.networkDef.inputs * 2;
        let parameterIndex = 0;
        prevLayerSize = this.networkDef.inputs;
        for (let layerIndex = 0, layersNum = layers.length; layerIndex < layersNum; ++layerIndex) {
            const layerDef = layers[layerIndex];
            switch (layerDef.type) {
                case LayerType.LINEAR:
                    const layerSize = layerDef.size;
                    const neuronSize = prevLayerSize * 2 + 2;
                    for (let neuronIndex = 0; neuronIndex < layerSize; ++neuronIndex) {
                        const neuronOffset = networkOffset + neuronSize * neuronIndex;
                        for (let i = 0; i < prevLayerSize; ++i) {
                            ret[parameterIndex++] = buffer[neuronOffset + i * 2 + 1];
                        }
                        ret[parameterIndex++] = buffer[neuronOffset + prevLayerSize * 2 + 1];
                    }
                    prevLayerSize = layerSize;
                    networkOffset += neuronSize * layerSize + layerSize * 2;
                    break;
                case LayerType.RE_LU:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.TANH:
                    networkOffset += prevLayerSize * 2;
                    break;
                case LayerType.SOFTMAX:
                    networkOffset += prevLayerSize * 2;
                    break;
            }
        }
        return ret;
    }

    optimizerZeroGrad() {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }
        (this.instance.exports as DenseModule).optimizerZeroGrad(this.optimizerDataOffset, this.numOfParameters);
        return this;
    }

    accumulateParameterGrads() {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }
        (this.instance.exports as DenseModule).accumulateParameterGrads(this.headerSize, this.networkOffset, this.optimizerDataOffset);
        return this;
    }

    updateParameters(
        batchSize: number,
        lr: number = 1e-3,
        beta1: number = 0.99,
        beta2: number = 0.999,
        epsilon: number = 1e-8
    ) {
        if (!this.instance || !this.memory) {
            throw new Error('Not initialized.');
        }
        (this.instance.exports as DenseModule).updateParameters(
            this.headerSize,
            this.networkOffset,
            this.optimizerDataOffset,
            beta1,
            beta2,
            lr,
            batchSize,
            this.epoch++,
            epsilon
        );
        return this;
    }

}
