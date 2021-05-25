import {AutoGradNode, div, exp, sum} from '../../auto-grad';
import NNLayer from './NNLayer';

export default class SoftmaxLayer implements NNLayer {

    outs: AutoGradNode[];
    parameters: AutoGradNode[] = [];

    constructor(inputs: AutoGradNode[]) {
        const ei = inputs.map(x => exp(x));
        const eSum = sum(ei);
        this.outs = ei.map(ei => div(ei, eSum));
    }

}
