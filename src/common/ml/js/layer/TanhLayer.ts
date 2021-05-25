import {AutoGradNode, tanh} from '../../auto-grad';
import NNLayer from './NNLayer';

export default class TanhLayer implements NNLayer {

    outs: AutoGradNode[];
    parameters: AutoGradNode[] = [];

    constructor(inputs: AutoGradNode[]) {
        this.outs = inputs.map(node => tanh(node));
    }

}
