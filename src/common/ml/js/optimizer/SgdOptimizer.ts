import {AutoGradNode} from '../../auto-grad';
import Optimizer from './Optimizer';

export default class SgdOptimizer implements Optimizer {

    parameters: AutoGradNode[];
    learnRate: number;
    gradSum: number[];

    constructor(parameters: AutoGradNode[], learnRate: number = 1e-5) {
        this.parameters = parameters;
        this.learnRate = learnRate;
        this.gradSum = this.parameters.map(param => 0);
    }

    zeroGrad() {
        this.gradSum = this.parameters.map(param => 0);
    }

    step() {
        this.parameters.forEach((param, index) => {
            this.gradSum[index] += param.grad;
        });
    }

    updateParameters(batchSize: number) {
        this.parameters.forEach((param, index) => {
            const grad = this.gradSum[index] / batchSize;
            param.value -= this.learnRate * grad;
        });
    }

}
