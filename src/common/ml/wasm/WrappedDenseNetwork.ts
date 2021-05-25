import {AutoGradNode, variable} from '../auto-grad';
import DenseNetwork from './DenseNetwork';

export default class WrappedDenseNetwork {

    network: DenseNetwork;
    inputs: AutoGradNode[];
    outputs: AutoGradNode[];

    constructor(
        network: DenseNetwork,
        inputs: AutoGradNode[]
    ) {
        this.network = network;
        this.inputs = inputs;
        this.outputs = Array(network.outputSize).fill(0).map(val => variable(val));
    }

    setInputs(values: ArrayLike<number>) {
        for (let i = 0, len = this.inputs.length; i < len; ++i) {
            this.inputs[i].value = values[i];
        }
        return this;
    }

    forward() {
        const buffer = this.network.getNetworkBuffer();
        for (let i = 0, len = this.inputs.length; i < len; ++i) {
            buffer[i * 2] = this.inputs[i].value;
        }
        this.network.forward();
        const outputSize = this.network.outputSize;
        const outputsOffset = this.network.networkSize - outputSize * 2;
        for (let i = 0, len = this.outputs.length; i < len; ++i) {
            this.outputs[i].value = buffer[outputsOffset + i * 2];
        }
        return this;
    }

    backward() {
        const buffer = this.network.getNetworkBuffer();
        const outputSize = this.network.outputSize;
        const outputsOffset = this.network.networkSize - outputSize * 2;
        for (let i = 0; i < outputSize; ++i) {
            buffer[outputsOffset + i * 2 + 1] = this.outputs[i].grad;
        }
        this.network.backward();
        for (let i = 0, len = this.inputs.length; i < len; ++i) {
            this.inputs[i].grad = buffer[i * 2 + 1];
        }
        return this;
    }

    run() {
        this.forward();
        return this.network.getOutputs();
    }

    getParameters() {
        return this.network.getParameters();
    }

    setParameters(parameters: ArrayLike<number>) {
        this.network.setParameters(parameters);
    }

    zeroGrad() {
        this.network.zeroGrad();
    }

    optimizerZeroGrad() {
        this.network.optimizerZeroGrad();
    }

    accumulateParameterGrads() {
        this.network.accumulateParameterGrads();
    }

    updateParameters(batchSize: number,
                     lr: number = 1e-3,
                     beta1: number = 0.99,
                     beta2: number = 0.999,
                     epsilon: number = 1e-8
    ) {
        this.network.updateParameters(batchSize, lr, beta1, beta2, epsilon);
    }

}
