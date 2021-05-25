import {AutoGradNode, div, minus, pow, sum, variable} from '../auto-grad';
import DenseModel from './DenseModel';
import DenseNetwork, {LayerDef} from './DenseNetwork';
import WrappedDenseNetwork from './WrappedDenseNetwork';

export function vector(s: number | (number | AutoGradNode)[]) {
    if (typeof s === 'number') {
        const ret: AutoGradNode[] = [];
        for (let i = s; i--;) {
            ret.push(variable(0));
        }
        return ret;
    } else {
        return s.map(item => typeof item === 'number' ? variable(item) : item);
    }
}

export async function network(inputs: AutoGradNode[], layers: LayerDef[]) {
    const network = new DenseNetwork();
    await network.init();
    network.defNetwork(inputs.length, layers);
    network.randomInitParameters();
    return new WrappedDenseNetwork(network, inputs);
}

export async function model(inputs: AutoGradNode[], layers: LayerDef[], loss: (yPred: AutoGradNode[], yTrue: AutoGradNode[]) => AutoGradNode) {
    const wrapped = await network(inputs, layers);
    return new DenseModel(wrapped, loss);
}

export function linear(size: number) {
    return DenseNetwork.linear(size);
}

export function reLU() {
    return DenseNetwork.reLU();
}

export function tanh() {
    return DenseNetwork.tanh();
}

export function softmax() {
    return DenseNetwork.softmax();
}

export function mseLoss(yPred: AutoGradNode[], yTrue: AutoGradNode[]) {
    return div(sum(yTrue.map((yi, index) => pow(minus(yi, yPred[index]), 2))), yTrue.length);
}
