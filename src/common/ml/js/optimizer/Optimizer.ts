export default interface Optimizer {

    zeroGrad(): void;

    step(): void;

    updateParameters(batchSize: number): void;

}
