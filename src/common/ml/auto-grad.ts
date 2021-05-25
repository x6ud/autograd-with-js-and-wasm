export const enum AutoGradNodeType {
    VARIABLE,
    SUM,
    ADD,
    MINUS,
    MUL,
    DIV,
    POW,
    EXP,
    LOG,
    RE_LU,
    TANH
}

export class AutoGradNode {
    type: AutoGradNodeType;
    value: number = 0;
    grad: number = 0;
    children?: AutoGradNode[];

    constructor(type: AutoGradNodeType, children?: AutoGradNode[]) {
        this.type = type;
        this.children = children;
    }
}

function getX(node: AutoGradNode) {
    return node.children![0];
}

function getY(node: AutoGradNode) {
    return node.children![1];
}

const nodeProcessFunctions: {
    [type in AutoGradNodeType]: {
        forward: (node: AutoGradNode) => void,
        backward: (node: AutoGradNode) => void
    }
} = {
    [AutoGradNodeType.VARIABLE]: {
        forward(node: AutoGradNode) {
        },
        backward(node: AutoGradNode) {
        }
    },
    [AutoGradNodeType.SUM]: {
        forward(node: AutoGradNode) {
            node.value = node.children!.reduce((sum, child) => sum + child.value, 0);
        },
        backward(node: AutoGradNode) {
            node.children!.forEach(xi => {
                xi.grad += node.grad;
            });
        }
    },
    [AutoGradNodeType.ADD]: {
        forward(node: AutoGradNode) {
            node.value = getX(node).value + getY(node).value;
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            const y = getY(node);
            x.grad += node.grad;
            y.grad += node.grad;
        }
    },
    [AutoGradNodeType.MINUS]: {
        forward(node: AutoGradNode) {
            node.value = getX(node).value - getY(node).value;
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            const y = getY(node);
            x.grad += node.grad;
            y.grad += -node.grad;
        }
    },
    [AutoGradNodeType.MUL]: {
        forward(node: AutoGradNode) {
            node.value = getX(node).value * getY(node).value;
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            const y = getY(node);
            x.grad += node.grad * y.value;
            y.grad += node.grad * x.value;
        }
    },
    [AutoGradNodeType.DIV]: {
        forward(node: AutoGradNode) {
            node.value = getX(node).value / getY(node).value;
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            const y = getY(node);
            x.grad += node.grad * (1 / y.value);
            y.grad += node.grad * (-x.value / y.value ** 2);
        }
    },
    [AutoGradNodeType.POW]: {
        forward(node: AutoGradNode) {
            node.value = Math.pow(getX(node).value, getY(node).value);
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            const y = getY(node);
            x.grad += node.grad * (y.value * Math.pow(x.value, y.value - 1));
        }
    },
    [AutoGradNodeType.EXP]: {
        forward(node: AutoGradNode) {
            node.value = Math.exp(getX(node).value);
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            x.grad += node.grad * (Math.exp(x.value));
        }
    },
    [AutoGradNodeType.LOG]: {
        forward(node: AutoGradNode) {
            node.value = Math.log(getX(node).value);
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            x.grad += node.grad * (1 / x.value);
        }
    },
    [AutoGradNodeType.RE_LU]: {
        forward(node: AutoGradNode) {
            node.value = Math.max(0, getX(node).value);
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            x.grad += node.grad * (x.value > 0 ? 1 : 0);
        }
    },
    [AutoGradNodeType.TANH]: {
        forward(node: AutoGradNode) {
            node.value = Math.tanh(getX(node).value);
        },
        backward(node: AutoGradNode) {
            const x = getX(node);
            x.grad += node.grad * (1 - Math.tanh(x.value) ** 2);
        }
    },
};

export function variable(value: number = 0): AutoGradNode {
    const ret = new AutoGradNode(AutoGradNodeType.VARIABLE);
    ret.value = value;
    return ret;
}

function wrap(value: number | AutoGradNode): AutoGradNode {
    return typeof value === 'number' ? variable(value) : value;
}

export function sum(vals: (AutoGradNode | number)[]) {
    return new AutoGradNode(AutoGradNodeType.SUM, vals.map(wrap));
}

export function add(a: AutoGradNode | number, b: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.ADD, [wrap(a), wrap(b)]);
}

export function minus(a: AutoGradNode | number, b: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.MINUS, [wrap(a), wrap(b)]);
}

export function mul(a: AutoGradNode | number, b: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.MUL, [wrap(a), wrap(b)]);
}

export function div(a: AutoGradNode | number, b: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.DIV, [wrap(a), wrap(b)]);
}

export function pow(a: AutoGradNode | number, b: number) {
    return new AutoGradNode(AutoGradNodeType.POW, [wrap(a), wrap(b)]);
}

export function exp(a: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.EXP, [wrap(a)]);
}

export function log(a: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.LOG, [wrap(a)]);
}

export function reLU(a: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.RE_LU, [wrap(a)]);
}

export function tanh(a: AutoGradNode | number) {
    return new AutoGradNode(AutoGradNodeType.TANH, [wrap(a)]);
}

export function forward(...nodes: AutoGradNode[]) {
    const headStack: AutoGradNode[] = [...nodes];
    const tailStack: AutoGradNode[] = [];
    const calculated: Set<AutoGradNode> = new Set<AutoGradNode>();
    for (; ;) {
        let childrenCalculated = false;
        let node = headStack.pop();
        if (!node) {
            node = tailStack.pop();
            childrenCalculated = true;
        }
        if (!node) {
            break;
        }
        if (node.type === AutoGradNodeType.VARIABLE) {
            continue;
        }
        if (calculated.has(node)) {
            continue;
        }
        if (!childrenCalculated) {
            tailStack.push(node);
            node.children?.forEach(child => headStack.push(child));
        } else {
            nodeProcessFunctions[node.type].forward(node);
            calculated.add(node);
        }
    }
}

export function zeroGrad(...nodes: AutoGradNode[]) {
    const headStack: AutoGradNode[] = [...nodes];
    const tailStack: AutoGradNode[] = [];
    for (; ;) {
        let childrenVisited = false;
        let node = headStack.pop();
        if (!node) {
            node = tailStack.pop();
            childrenVisited = true;
        }
        if (!node) {
            break;
        }
        if (!childrenVisited) {
            tailStack.push(node);
            node.children?.forEach(child => headStack.push(child));
        } else {
            node.grad = 0;
        }
    }
}

export function backward(...nodes: AutoGradNode[]) {
    const headStack: AutoGradNode[] = [...nodes];
    const tailStack: AutoGradNode[] = [];
    const visited: Set<AutoGradNode> = new Set<AutoGradNode>();
    const topo: AutoGradNode[] = [];
    for (; ;) {
        let childrenVisited = false;
        let node = headStack.pop();
        if (!node) {
            node = tailStack.pop();
            childrenVisited = true;
        }
        if (!node) {
            break;
        }
        if (visited.has(node)) {
            continue;
        }
        if (!childrenVisited) {
            tailStack.push(node);
            node.children?.forEach(child => headStack.push(child));
        } else {
            visited.add(node);
            topo.unshift(node);
        }
    }
    topo.forEach(node => {
        if (node.type !== AutoGradNodeType.VARIABLE) {
            nodeProcessFunctions[node.type].backward(node);
        }
    });
}
