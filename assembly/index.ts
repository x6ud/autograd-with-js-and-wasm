enum LayerType {
    LINEAR = 1,
    RE_LU = 2,
    TANH = 3,
    SOFTMAX = 4
}

function loadU32(address: usize): u32 {
    return load<u32>(address << 2);
}

function loadF64(address: usize): f64 {
    return load<f64>(address << 3);
}

function storeF64(address: usize, value: f64): void {
    store<f64>(address << 3, value);
}

export function forward(headerSize: usize, networkOffset: usize): void {
    // header: [0][inputs_len][layer_1_type][layer_1_size]...[layer_n_type][layer_n_size]
    const inputs = loadU32(1);
    let prevLayerSize: u32 = inputs;
    let inputsOffset = networkOffset;
    networkOffset += inputs << 1;

    // foreach layer
    for (let headerOffset: usize = 2; headerOffset < headerSize; headerOffset += 2) {
        const layerType = loadU32(headerOffset);
        switch (layerType) {
            case LayerType.LINEAR: {
                // [w1_1][w1_1_grad][w1_2][w1_2_grad]...[w1_m][w1_m_grad] [b1][b1_grad]
                // ...
                // [wn_1][wn_1_grad][wn_2][w1_2_grad]...[wn_m][wn_m_grad] [bn][bn_grad]
                // [out_1][out_1_grad]...[out_n][out_n_grad]

                const layerSize = loadU32(headerOffset + 1);
                // numOfParamsOfNeuron = inputs + 1 (w * inputs and b)
                const neuronBufferLen = (prevLayerSize << 1) + 2;
                // address of layer outputs
                const outsOffset = networkOffset + neuronBufferLen * layerSize;
                // foreach neuron
                for (let neuronIndex: u32 = 0; neuronIndex < layerSize; ++neuronIndex) {
                    // out = sum(w_i * x_i) + b
                    const neuronOffset = networkOffset + neuronBufferLen * neuronIndex;
                    let out: f64 = 0;
                    for (let i: u32 = 0; i < prevLayerSize; ++i) {
                        const w = loadF64(neuronOffset + (i << 1));
                        const x = loadF64(inputsOffset + (i << 1));
                        out += w * x;
                    }
                    const b = loadF64(neuronOffset + (prevLayerSize << 1));
                    out += b;
                    storeF64(outsOffset + (neuronIndex << 1), out);
                }
                prevLayerSize = layerSize;
                inputsOffset = outsOffset;
                networkOffset += neuronBufferLen * layerSize + (layerSize << 1);
            }
                break;

            case LayerType.RE_LU: {
                // [out_1][out_1_grad]...[out_n][out_n_grad]

                // out_i = ReLU(x_i)
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    const x = loadF64(inputsOffset + (i << 1));
                    storeF64(networkOffset + (i << 1), x < 0 ? 0 : x);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.TANH: {
                // [out_1][out_1_grad]...[out_n][out_n_grad]

                // out_i = tanh(x_i)
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    const x = loadF64(inputsOffset + (i << 1));
                    storeF64(networkOffset + (i << 1), Math.tanh(x));
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.SOFTMAX: {
                // [out_1][out_1_grad]...[out_n][out_n_grad]

                // out_i = e^x_i / sum(e^x_i)
                let sum: f64 = 0;
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    const x = loadF64(inputsOffset + (i << 1));
                    const exp = Math.exp(x);
                    sum += exp;
                    storeF64(networkOffset + (i << 1), exp);
                }
                const invSum = 1 / sum;
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    const exp = loadF64(networkOffset + (i << 1));
                    storeF64(networkOffset + (i << 1), exp * invSum);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            default:
                throw new Error('Undefined layer type ' + layerType.toString());
        }
    }
}

export function zeroGrad(headerSize: usize, networkOffset: usize): void {
    const inputs = loadU32(1);
    for (let i: u32 = 0; i < inputs; ++i) {
        storeF64(networkOffset + (i << 1) + 1, 0);
    }
    let prevLayerSize: u32 = inputs;
    let inputsOffset = networkOffset;
    networkOffset += inputs << 1;

    for (let headerOffset: usize = 2; headerOffset < headerSize; headerOffset += 2) {
        const layerType = loadU32(headerOffset);
        switch (layerType) {
            case LayerType.LINEAR: {
                const layerSize = loadU32(headerOffset + 1);
                const neuronBufferLen = (prevLayerSize << 1) + 2;
                const outsOffset = networkOffset + neuronBufferLen * layerSize;
                for (let neuronIndex: u32 = 0; neuronIndex < layerSize; ++neuronIndex) {
                    const neuronOffset = networkOffset + neuronBufferLen * neuronIndex;
                    for (let i: u32 = 0; i < prevLayerSize; ++i) {
                        storeF64(neuronOffset + (i << 1) + 1, 0);
                    }
                    storeF64(neuronOffset + (prevLayerSize << 1) + 1, 0);
                    storeF64(outsOffset + (neuronIndex << 1) + 1, 0);
                }
                prevLayerSize = layerSize;
                inputsOffset = outsOffset;
                networkOffset += neuronBufferLen * layerSize + (layerSize << 1);
            }
                break;

            case LayerType.RE_LU: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.TANH: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.SOFTMAX: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            default:
                throw new Error('Undefined layer type ' + layerType.toString());
        }
    }
}

export function backward(headerSize: usize, networkOffset: usize, networkSize: usize): void {
    networkOffset += networkSize;
    for (let headerOffset = headerSize - 2; headerOffset >= 2; headerOffset -= 2) {
        const layerType = loadU32(headerOffset);
        const layerSize = loadU32(headerOffset + 1);
        const inputSize = loadU32(headerOffset - 1);
        const outputsOffset = networkOffset - (layerSize << 1);

        switch (layerType) {
            case LayerType.LINEAR: {
                const neuronBufferLen = (inputSize << 1) + 2;
                const parametersOffset = outputsOffset - neuronBufferLen * layerSize;
                const inputsOffset = parametersOffset - (inputSize << 1);
                // out = sum(w_i * x_i) + b
                // d_out/d_w_i = x_i
                // d_out/d_b = 1
                for (let neuronIndex: u32 = 0; neuronIndex < layerSize; ++neuronIndex) {
                    const outGrad = loadF64(outputsOffset + (neuronIndex << 1) + 1);
                    const neuronOffset = parametersOffset + neuronBufferLen * neuronIndex;
                    for (let i: u32 = 0; i < inputSize; ++i) {
                        const x = loadF64(inputsOffset + (i << 1));
                        storeF64(neuronOffset + (i << 1) + 1, outGrad * x);
                    }
                    storeF64(neuronOffset + (inputSize << 1) + 1, outGrad);
                }
                // d_out/d_x_i = sum(w_j)
                for (let i: u32 = 0; i < inputSize; ++i) {
                    let xGrad: f64 = 0;
                    for (let neuronIndex: u32 = 0; neuronIndex < layerSize; ++neuronIndex) {
                        const outGrad = loadF64(outputsOffset + (neuronIndex << 1) + 1);
                        const w = loadF64(parametersOffset + neuronBufferLen * neuronIndex + (i << 1));
                        xGrad += outGrad * w;
                    }
                    storeF64(inputsOffset + (i << 1) + 1, xGrad);
                }

                networkOffset = parametersOffset;
            }
                break;

            case LayerType.RE_LU: {
                const inputsOffset = outputsOffset - (inputSize << 1);

                // d_out/d_x = x > 0 ? 1 : 0
                for (let i: u32 = 0; i < inputSize; ++i) {
                    const outGrad = loadF64(outputsOffset + (i << 1) + 1);
                    const x = loadF64(inputsOffset + (i << 1));
                    storeF64(inputsOffset + (i << 1) + 1, x > 0 ? outGrad : 0);
                }

                networkOffset = outputsOffset;
            }
                break;

            case LayerType.TANH: {
                const inputsOffset = outputsOffset - (inputSize << 1);

                // d_out/d_x = 1 - tanh(x)^2 = 1 - out^2
                for (let i: u32 = 0; i < inputSize; ++i) {
                    const out = loadF64(outputsOffset + (i << 1));
                    const outGrad = loadF64(outputsOffset + (i << 1) + 1);
                    const x = loadF64(inputsOffset + (i << 1));
                    storeF64(inputsOffset + (i << 1) + 1, outGrad * (1 - out ** 2));
                }

                networkOffset = outputsOffset;
            }
                break;

            case LayerType.SOFTMAX: {
                const inputsOffset = outputsOffset - (inputSize << 1);
                // S(x_i) = e^x_i / sum(e^x_j) = out_i
                // d_S(x_i)/d_x_i = out_i * (1 - out_i)
                // d_S(x_j)/d_x_j = -out_i * out_j
                for (let i: u32 = 0; i < inputSize; ++i) {
                    const outI = loadF64(outputsOffset + (i << 1));
                    let xGrad: f64 = 0;
                    for (let j: u32 = 0; j < inputSize; ++j) {
                        const outGrad = loadF64(outputsOffset + (j << 1) + 1);
                        if (i == j) {
                            xGrad += outGrad * (outI * (1 - outI));
                        } else {
                            const outJ = loadF64(outputsOffset + (j << 1));
                            xGrad += outGrad * (-outI * outJ);
                        }
                    }
                    storeF64(inputsOffset + (i << 1) + 1, xGrad);
                }

                networkOffset = outputsOffset;
            }
                break;

            default:
                throw new Error('Undefined layer type ' + layerType.toString());
        }
    }
}

export function optimizerZeroGrad(optimizerDataOffset: usize, numOfParameters: u32): void {
    let parameterIndex: u32 = 0;
    for (let i: u32 = 0; i < numOfParameters; ++i) {
        storeF64(optimizerDataOffset + (parameterIndex++) * 3, 0);
    }
}

export function accumulateParameterGrads(headerSize: usize, networkOffset: usize, optimizerDataOffset: usize): void {
    const inputs = loadU32(1);
    for (let i: u32 = 0; i < inputs; ++i) {
        storeF64(networkOffset + (i << 1) + 1, 0);
    }
    let prevLayerSize: u32 = inputs;
    let inputsOffset = networkOffset;
    networkOffset += inputs << 1;
    let parameterIndex: u32 = 0;

    for (let headerOffset: usize = 2; headerOffset < headerSize; headerOffset += 2) {
        const layerType = loadU32(headerOffset);
        switch (layerType) {
            case LayerType.LINEAR: {
                const layerSize = loadU32(headerOffset + 1);
                const neuronBufferLen = (prevLayerSize << 1) + 2;
                const outsOffset = networkOffset + neuronBufferLen * layerSize;
                for (let neuronIndex: u32 = 0; neuronIndex < layerSize; ++neuronIndex) {
                    const neuronOffset = networkOffset + neuronBufferLen * neuronIndex;
                    for (let i: u32 = 0; i < prevLayerSize; ++i) {
                        const paramMomentumOffset = optimizerDataOffset + (parameterIndex++) * 3;
                        const gradSum = loadF64(paramMomentumOffset);
                        const grad = loadF64(neuronOffset + (i << 1) + 1);
                        storeF64(paramMomentumOffset, gradSum + grad);
                    }
                    const paramMomentumOffset = optimizerDataOffset + (parameterIndex++) * 3;
                    const gradSum = loadF64(paramMomentumOffset);
                    const grad = loadF64(neuronOffset + (prevLayerSize << 1) + 1);
                    storeF64(paramMomentumOffset, gradSum + grad);
                }
                prevLayerSize = layerSize;
                inputsOffset = outsOffset;
                networkOffset += neuronBufferLen * layerSize + (layerSize << 1);
            }
                break;

            case LayerType.RE_LU: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.TANH: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.SOFTMAX: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            default:
                throw new Error('Undefined layer type ' + layerType.toString());
        }
    }
}

export function updateParameters(
    headerSize: usize,
    networkOffset: usize,
    optimizerDataOffset: usize,
    beta1: f64,
    beta2: f64,
    lr: f64,
    batchSize: f64,
    epoch: u32,
    epsilon: f64
): void {
    const inputs = loadU32(1);
    for (let i: u32 = 0; i < inputs; ++i) {
        storeF64(networkOffset + (i << 1) + 1, 0);
    }
    let prevLayerSize: u32 = inputs;
    let inputsOffset = networkOffset;
    networkOffset += inputs << 1;
    let parameterIndex: u32 = 0;
    const invBatchSize = 1 / batchSize;

    for (let headerOffset: usize = 2; headerOffset < headerSize; headerOffset += 2) {
        const layerType = loadU32(headerOffset);
        switch (layerType) {
            case LayerType.LINEAR: {
                const layerSize = loadU32(headerOffset + 1);
                const neuronBufferLen = (prevLayerSize << 1) + 2;
                const outsOffset = networkOffset + neuronBufferLen * layerSize;
                for (let neuronIndex: u32 = 0; neuronIndex < layerSize; ++neuronIndex) {
                    const neuronOffset = networkOffset + neuronBufferLen * neuronIndex;
                    for (let i: u32 = 0; i < prevLayerSize; ++i) {
                        const paramMomentumOffset = optimizerDataOffset + (parameterIndex++) * 3;
                        const paramOffset = neuronOffset + (i << 1);
                        const gradSum = loadF64(paramMomentumOffset);
                        const grad = gradSum * invBatchSize;
                        let m = loadF64(paramMomentumOffset + 1);
                        let v = loadF64(paramMomentumOffset + 2);
                        m = beta1 * m + (1 - beta1) * grad;
                        v = beta2 * v + (1 - beta2) * grad ** 2;
                        storeF64(paramMomentumOffset + 1, m);
                        storeF64(paramMomentumOffset + 2, v);
                        const mCap = m / (1 - beta1 ** epoch);
                        const vCap = v / (1 - beta2 ** epoch);
                        const paramValue = loadF64(paramOffset);
                        storeF64(paramOffset, paramValue - lr * mCap / (Math.sqrt(vCap) + epsilon));
                    }
                    const paramMomentumOffset = optimizerDataOffset + (parameterIndex++) * 3;
                    const paramOffset = neuronOffset + (prevLayerSize << 1);
                    const gradSum = loadF64(paramMomentumOffset);
                    const grad = gradSum * invBatchSize;
                    let m = loadF64(paramMomentumOffset + 1);
                    let v = loadF64(paramMomentumOffset + 2);
                    m = beta1 * m + (1 - beta1) * grad;
                    v = beta2 * v + (1 - beta2) * grad ** 2;
                    storeF64(paramMomentumOffset + 1, m);
                    storeF64(paramMomentumOffset + 2, v);
                    const mCap = m / (1 - beta1 ** epoch);
                    const vCap = v / (1 - beta2 ** epoch);
                    const paramValue = loadF64(paramOffset);
                    storeF64(paramOffset, paramValue - lr * mCap / (Math.sqrt(vCap) + epsilon));
                }
                prevLayerSize = layerSize;
                inputsOffset = outsOffset;
                networkOffset += neuronBufferLen * layerSize + (layerSize << 1);
            }
                break;

            case LayerType.RE_LU: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.TANH: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            case LayerType.SOFTMAX: {
                for (let i: u32 = 0; i < prevLayerSize; ++i) {
                    storeF64(networkOffset + (i << 1) + 1, 0);
                }
                inputsOffset = networkOffset;
                networkOffset += prevLayerSize << 1;
            }
                break;

            default:
                throw new Error('Undefined layer type ' + layerType.toString());
        }
    }
}
