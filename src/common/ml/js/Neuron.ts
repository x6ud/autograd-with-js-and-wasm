import {add, AutoGradNode, mul, variable} from '../auto-grad';

export default class Neuron {

    w: AutoGradNode[];
    b: AutoGradNode;
    out: AutoGradNode;
    parameters: AutoGradNode[];

    constructor(inputs: AutoGradNode[]) {
        const w = this.w = inputs.map(input => variable(Math.random() * 2 - 1));
        const b = this.b = variable(0);
        const wi = inputs.map((input, index) => mul(w[index], input));
        let out: AutoGradNode = wi[0];
        for (let i = 1, len = wi.length; i < len; ++i) {
            out = add(out, wi[i]);
        }
        out = add(out, b);
        this.out = out;
        this.parameters = [...w, b];
    }

}
