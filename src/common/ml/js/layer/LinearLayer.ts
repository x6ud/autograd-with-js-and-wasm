import {AutoGradNode} from '../../auto-grad';
import Neuron from '../Neuron';
import NNLayer from './NNLayer';

export default class LinearLayer implements NNLayer {

    neurons: Neuron[];
    outs: AutoGradNode[];
    parameters: AutoGradNode[];

    constructor(inputs: AutoGradNode[], outs: number) {
        const neurons: Neuron[] = [];
        for (let i = 0; i < outs; ++i) {
            neurons.push(new Neuron(inputs));
        }
        this.neurons = neurons;
        this.outs = neurons.map(neuron => neuron.out);
        this.parameters = neurons.reduce((arr, curr) => arr.concat(curr.parameters), [] as AutoGradNode[]);
    }

}
