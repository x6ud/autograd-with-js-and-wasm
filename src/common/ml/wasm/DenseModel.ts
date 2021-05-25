import {AutoGradNode, backward, forward, variable, zeroGrad} from '../auto-grad';
import WrappedDenseNetwork from './WrappedDenseNetwork';

export default class DenseModel {

    wrapped: WrappedDenseNetwork;
    loss: AutoGradNode;
    avgLoss: number = 0;
    private readonly yTrue: AutoGradNode[];
    private batchSize: number = 0;

    constructor(
        wrapped: WrappedDenseNetwork,
        loss: (yPred: AutoGradNode[], yTrue: AutoGradNode[]) => AutoGradNode
    ) {
        this.wrapped = wrapped;
        this.yTrue = Array(wrapped.network.outputSize).fill(0).map(val => variable(val));
        this.loss = loss(wrapped.outputs, this.yTrue);
    }

    beginBatch() {
        this.wrapped.network.optimizerZeroGrad();
        this.avgLoss = 0;
        this.batchSize = 0;
    }

    step(x: ArrayLike<number>, y: ArrayLike<number>) {
        this.batchSize += 1;

        this.wrapped.setInputs(x);
        for (let i = 0, len = y.length; i < len; ++i) {
            this.yTrue[i].value = y[i];
        }

        this.wrapped.forward();
        forward(this.loss);

        this.avgLoss += this.loss.value;

        zeroGrad(this.loss);
        this.wrapped.network.zeroGrad();
        this.loss.grad = 1;
        backward(this.loss);
        this.wrapped.backward();
        this.wrapped.network.accumulateParameterGrads();
    }

    endBatch() {
        if (this.batchSize < 1) {
            return;
        }
        this.wrapped.network.updateParameters(this.batchSize);
        this.avgLoss /= this.batchSize;
    }

    pred(inputs: ArrayLike<number>) {
        this.wrapped.setInputs(inputs);
        this.wrapped.forward();
        return this.wrapped.network.getOutputs();
    }

    getParameters() {
        return this.wrapped.network.getParameters();
    }

    setParameters(parameters: ArrayLike<number>) {
        this.wrapped.network.setParameters(parameters);
    }

}
