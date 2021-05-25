import {AutoGradNode, forward} from '../auto-grad';
import NNLayer from './layer/NNLayer';

export default class MLP {

    inputs: AutoGradNode[];
    layers: NNLayer[];
    outs: AutoGradNode[];
    parameters: AutoGradNode[];

    constructor(
        inputs: AutoGradNode[],
        layers: ((inputs: AutoGradNode[]) => NNLayer)[]
    ) {
        let prev = inputs;
        const model: NNLayer[] = [];
        for (let i = 0, len = layers.length; i < len; ++i) {
            const creator = layers[i];
            const layer = creator(prev);
            model.push(layer);
            prev = layer.outs;
        }
        this.inputs = inputs;
        this.layers = model;
        this.parameters = [];
        model.forEach(layer => {
            this.parameters.push(...layer.parameters);
        });
        this.outs = model[model.length - 1].outs;
    }

    setInputs(inputs: number[]) {
        inputs.forEach((val, index) => this.inputs[index].value = val);
        return this;
    }

    run() {
        forward(...this.outs);
        return this.outs.map(node => node.value);
    }

}
