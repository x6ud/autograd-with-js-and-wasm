import {AssertionError, strictEqual} from 'assert';
import {describe, it} from 'mocha';
import {
    variable,
    sum,
    add,
    minus,
    mul,
    div,
    pow,
    exp,
    log,
    reLU,
    tanh,
    forward,
    zeroGrad,
    backward,
} from '../src/common/ml/auto-grad';
import * as nn from '../src/common/ml/js/nn';

function equals(x: number, y: number) {
    if (Math.abs(x - y) > 1e-12) {
        throw new AssertionError({expected: y, actual: x});
    }
}

describe('auto-grad', () => {

    it('forward sum', () => {
        const x = Array(5).fill(0).map(Math.random);
        const y = x.reduce((sum, x) => sum + x, 0);
        const node = sum(x);
        forward(node);
        equals(node.value, y);
    });

    it('forward add', () => {
        const x1 = Math.random();
        const x2 = Math.random();
        const y = x1 + x2;
        const node = add(x1, x2);
        forward(node);
        equals(node.value, y);
    });

    it('forward minus', () => {
        const x1 = Math.random();
        const x2 = Math.random();
        const y = x1 - x2;
        const node = minus(x1, x2);
        forward(node);
        equals(node.value, y);
    });

    it('forward mul', () => {
        const x1 = Math.random();
        const x2 = Math.random();
        const y = x1 * x2;
        const node = mul(x1, x2);
        forward(node);
        equals(node.value, y);
    });

    it('forward div', () => {
        const x1 = Math.random();
        const x2 = Math.random();
        const y = x1 / x2;
        const node = div(x1, x2);
        forward(node);
        equals(node.value, y);
    });

    it('forward pow', () => {
        const x1 = Math.random();
        const x2 = Math.random();
        const y = Math.pow(x1, x2);
        const node = pow(x1, x2);
        forward(node);
        equals(node.value, y);
    });

    it('forward exp', () => {
        const x = Math.random();
        const y = Math.exp(x);
        const node = exp(x);
        forward(node);
        equals(node.value, y);
    });

    it('forward log', () => {
        const x = Math.random();
        const y = Math.log(x);
        const node = log(x);
        forward(node);
        equals(node.value, y);
    });

    it('forward reLU', () => {
        const x = Math.random();
        const y = Math.max(0, x);
        const node = reLU(x);
        forward(node);
        equals(node.value, y);
    });

    it('forward tanh', () => {
        const x = Math.random();
        const y = Math.tanh(x);
        const node = tanh(x);
        forward(node);
        equals(node.value, y);
    });

    it('forward softmax', () => {
        const n = 12;
        const x = Array(n).fill(1).map(_ => Math.random());
        const varExpX = x.map(variable).map(exp);
        const varSumExp = sum(varExpX);
        const s = varExpX.map(ex => div(ex, varSumExp));
        const expX = x.map(Math.exp);
        const expSum = expX.reduce((sum, x) => sum + x, 0);
        const sTrue = expX.map(x => x / expSum);
        forward(...s);
        s.forEach((s, index) => {
            equals(s.value, sTrue[index]);
        });
    });

    it('zero-grad', () => {
        const mlp = nn.mlp(nn.vector(4), [nn.linear(5), nn.linear(5)]);
        mlp.parameters.forEach(node => node.grad = 1);
        zeroGrad(...mlp.outs);
        mlp.parameters.forEach(node => strictEqual(node.grad, 0));
    });

    it('backward sum', () => {
        // d_sum(x)/d_x = 1
        const x = Array(5).fill(0).map(Math.random).map(variable);
        const y = sum(x);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        x.forEach(xi => equals(xi.grad, 1));
    });

    it('backward add', () => {
        const x1 = variable(Math.random());
        const x2 = variable(Math.random());
        const y = add(x1, x2);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(x1 + x2)/d_x1 = 1
        // d(x1 + x2)/d_x2 = 1
        equals(x1.grad, 1);
        equals(x2.grad, 1);
    });

    it('backward minus', () => {
        const x1 = variable(Math.random());
        const x2 = variable(Math.random());
        const y = minus(x1, x2);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(x1 - x2)/d_x1 = 1
        // d(x1 - x2)/d_x2 = -1
        equals(x1.grad, 1);
        equals(x2.grad, -1);
    });

    it('backward mul', () => {
        const x1 = variable(Math.random());
        const x2 = variable(Math.random());
        const y = mul(x1, x2);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(x1 * x2)/d_x1 = x2
        // d(x1 * x2)/d_x2 = x1
        equals(x1.grad, x2.value);
        equals(x2.grad, x1.value);
    });

    it('backward div', () => {
        const x1 = variable(Math.random());
        const x2 = variable(Math.random());
        const y = div(x1, x2);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(x1 / x2)/d_x1 = 1/x2
        // d(x1 / x2)/d_x2 = -x1/x2**2
        equals(x1.grad, 1 / x2.value);
        equals(x2.grad, -x1.value / x2.value ** 2);
    });

    it('backward pow', () => {
        const x1 = variable(Math.random());
        const x2 = Math.random();
        const y = pow(x1, x2);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(x1 ^ x2)/d_x1 = x2*x1^(x2-1)
        equals(x1.grad, x2 * x1.value ** (x2 - 1));
    });

    it('backward exp', () => {
        const x = variable(Math.random());
        const y = exp(x);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(e^x)/d_x = e^x
        equals(x.grad, Math.exp(x.value));
    });

    it('backward log', () => {
        const x = variable(Math.random());
        const y = log(x);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(log(x))/d_x = 1/x
        equals(x.grad, 1 / x.value);
    });

    it('backward reLU', () => {
        const x = variable(Math.random());
        const y = reLU(x);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(reLU(x))/d_x = x > 0 ? 1 : 0
        equals(x.grad, x.value > 0 ? 1 : 0);
    });

    it('backward tanh', () => {
        const x = variable(Math.random());
        const y = tanh(x);
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // d(tanh(x))/d_x = 1 - tanh(x)**2
        equals(x.grad, 1 - Math.tanh(x.value) ** 2);
    });

    it('backward a(e^x)^2+b(e^x)+c', () => {
        const a = Math.random();
        const b = Math.random();
        const c = Math.random();
        const x = variable(Math.random());
        const ex = exp(x);
        const y = add(mul(a, pow(ex, 2)), add(mul(b, ex), c));
        forward(y);
        zeroGrad(y);
        y.grad = 1;
        backward(y);
        // f(x) = ax^2+bx+c
        // f'(x) = 2ax + b
        // f(e^x)' = f'(e^x) * e^x
        equals(x.grad, (2 * a * Math.exp(x.value) + b) * Math.exp(x.value));
    });

    it('backward softmax', () => {
        const n = Math.round(Math.random() * 4) + 1;
        const x = Array(n).fill(1).map(_ => (Math.random() * 2 - 1));
        const varX = x.map(variable);
        const varExpX = varX.map(exp);
        const varSumExp = sum(varExpX);
        const s = varExpX.map(ex => div(ex, varSumExp));
        const expX = x.map(Math.exp);
        const expSum = expX.reduce((sum, x) => sum + x, 0);
        const sTrue = expX.map(x => x / expSum);
        forward(...s);
        zeroGrad(...s);
        const outGrads = Array(n).fill(1).map(_ => (Math.random() * 2 - 1));
        s.forEach((s, index) => s.grad = outGrads[index]);
        backward(...s);
        const gradTrue = sTrue.map((s, i) => {
            let grad = 0;
            for (let j = 0; j < n; ++j) {
                if (i === j) {
                    grad += s * (1 - s) * outGrads[j];
                } else {
                    grad += -s * sTrue[j] * outGrads[j];
                }
            }
            return grad;
        });
        varX.forEach((x, index) => {
            equals(x.grad, gradTrue[index]);
        });
    });

});
