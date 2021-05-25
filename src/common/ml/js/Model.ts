import {AutoGradNode, backward, forward, variable, zeroGrad} from '../auto-grad';
import MLP from './MLP';
import AdamOptimizer from './optimizer/AdamOptimizer';
import Optimizer from './optimizer/Optimizer';

export default class Model {

    mlp: MLP;
    yTrue: AutoGradNode[];
    loss: AutoGradNode;
    optimizer: Optimizer;
    avgLoss: number = 0;
    batchSize: number = 0;

    constructor(
        mlp: MLP,
        loss: (yPred: AutoGradNode[], yTrue: AutoGradNode[]) => AutoGradNode
    ) {
        this.mlp = mlp;
        this.yTrue = mlp.outs.map(() => variable(0));
        this.loss = loss(this.mlp.outs, this.yTrue);
        this.optimizer = new AdamOptimizer(mlp.parameters);
    }

    beginBatch() {
        this.optimizer.zeroGrad();
        this.avgLoss = 0;
        this.batchSize = 0;
    }

    step(x: number[], y: number[]) {
        this.batchSize += 1;
        this.mlp.setInputs(x);
        y.forEach((value, index) => {
            this.yTrue[index].value = value;
        });

        forward(this.loss);
        this.avgLoss += this.loss.value;
        zeroGrad(this.loss);
        this.loss.grad = 1;
        backward(this.loss);
        this.optimizer.step();
    }

    endBatch() {
        if (this.batchSize < 1) {
            return;
        }
        this.optimizer.updateParameters(this.batchSize);
        this.avgLoss /= this.batchSize;
    }

    pred(inputs: number[]) {
        return this.mlp.setInputs(inputs).run();
    }

}
