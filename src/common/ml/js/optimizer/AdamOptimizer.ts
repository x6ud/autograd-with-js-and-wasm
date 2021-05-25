import {AutoGradNode} from '../../auto-grad';
import Optimizer from './Optimizer';

class ParamMomentum {
    param: AutoGradNode;
    gradSum: number = 0;
    m: number = 0;
    v: number = 0;

    constructor(param: AutoGradNode) {
        this.param = param;
    }
}

export default class AdamOptimizer implements Optimizer {

    parameters: AutoGradNode[];
    private paramMomentum: ParamMomentum[];
    private epoch: number = 1;

    learnRate: number;
    beta1: number;
    beta2: number;

    constructor(parameters: AutoGradNode[], learnRate: number = 1e-3, beta1: number = 0.99, beta2: number = 0.999) {
        this.parameters = parameters;
        this.learnRate = learnRate;
        this.beta1 = beta1;
        this.beta2 = beta2;
        this.paramMomentum = parameters.map(param => new ParamMomentum(param));
    }

    zeroGrad() {
        this.paramMomentum.forEach(p => {
            p.gradSum = 0;
        });
    }

    step() {
        this.paramMomentum.forEach(p => {
            p.gradSum += p.param.grad;
        });
    }

    updateParameters(batchSize: number) {
        const beta1 = this.beta1;
        const beta2 = this.beta1;
        const learnRate = this.learnRate;
        this.paramMomentum.forEach(p => {
            const grad = p.gradSum / batchSize;
            p.m = beta1 * p.m + (1 - beta1) * grad;
            p.v = beta2 * p.v + (1 - beta2) * grad ** 2;
            const mCap = p.m / (1 - beta1 ** this.epoch);
            const vCap = p.v / (1 - beta2 ** this.epoch);
            p.param.value -= learnRate * mCap / (Math.sqrt(vCap) + 1e-8);
        });
        this.epoch += 1;
    }

}
