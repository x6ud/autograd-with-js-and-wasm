import {AutoGradNode, reLU} from '../../auto-grad';
import NNLayer from './NNLayer';

export default class ReLULayer implements NNLayer {

    outs: AutoGradNode[];
    parameters: AutoGradNode[] = [];

    constructor(inputs: AutoGradNode[]) {
        this.outs = inputs.map(node => reLU(node));
    }

}
