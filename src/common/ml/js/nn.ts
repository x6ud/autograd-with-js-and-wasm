import {AutoGradNode, div, minus, pow, sum, variable} from '../auto-grad';

import LinearLayer from './layer/LinearLayer';
import NNLayer from './layer/NNLayer';
import ReLULayer from './layer/ReLULayer';
import SoftmaxLayer from './layer/SoftmaxLayer';
import TanhLayer from './layer/TanhLayer';
import MLP from './MLP';
import Model from './Model';

import AdamOptimizer from './optimizer/AdamOptimizer';

export function model(
    mlp: MLP,
    loss: (yPred: AutoGradNode[], yTrue: AutoGradNode[]) => AutoGradNode
) {
    return new Model(mlp, loss);
}

export function mlp(inputs: AutoGradNode[], layers: ((inputs: AutoGradNode[]) => NNLayer)[]) {
    return new MLP(inputs, layers);
}

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

export function linear(outs: number) {
    return function (inputs: AutoGradNode[]) {
        return new LinearLayer(inputs, outs);
    };
}

export function reLU() {
    return function (inputs: AutoGradNode[]) {
        return new ReLULayer(inputs);
    }
}

export function tanh() {
    return function (inputs: AutoGradNode[]) {
        return new TanhLayer(inputs);
    }
}

export function softmax() {
    return function (inputs: AutoGradNode[]) {
        return new SoftmaxLayer(inputs);
    }
}

export function adamOptimizer(parameters: AutoGradNode[], learnRate: number = 1e-3, beta1: number = 0.99, beta2: number = 0.999) {
    return new AdamOptimizer(parameters, learnRate, beta1, beta2);
}

export function mseLoss(yPred: AutoGradNode[], yTrue: AutoGradNode[]) {
    return div(sum(yTrue.map((yi, index) => pow(minus(yi, yPred[index]), 2))), yTrue.length);
}
