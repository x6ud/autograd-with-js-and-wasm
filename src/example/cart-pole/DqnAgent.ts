// https://github.com/noisyn/DQN_Agent_CartPole

import * as dense from '../../common/ml/wasm/dense';
import DenseModel from '../../common/ml/wasm/DenseModel';
import {shuffleArray} from '../../common/utils/random';
import CartPoleEnv from './CartPoleEnv';

type Record = { state: number[], action: number, reward: number, nextState: number[], done: boolean };

class ExperienceBuffer {
    capacity: number;
    memory: Record[] = [];

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    add(record: Record) {
        if (this.memory.length >= this.capacity) {
            this.memory.shift();
        }
        this.memory.push(record);
    }

    sample(batchSize: number) {
        const indices: number[] = [];
        for (let i = 0, len = this.memory.length; i < len; ++i) {
            indices.push(i);
        }
        shuffleArray(indices, Math.min(batchSize, indices.length));
        const batch: Record[] = [];
        indices.forEach(index => {
            batch.push(this.memory[index]);
        });
        return batch;
    }

    filled() {
        return this.memory.length >= this.capacity;
    }
}

function buildModel() {
    return dense.model(
        dense.vector(4),
        [
            dense.linear(24),
            dense.reLU(),
            dense.linear(24),
            dense.reLU(),
            dense.linear(2)
        ],
        dense.mseLoss
    );
}

const BATCH_SIZE = 48;
const REPLAY_SIZE = 1000;
const GAMMA = 0.9;

export default class DqnAgent {
    activeNetwork?: DenseModel;
    targetNetwork?: DenseModel;
    experience: ExperienceBuffer = new ExperienceBuffer(REPLAY_SIZE);

    constructor() {
    }

    async init() {
        this.activeNetwork = await buildModel();
        this.targetNetwork = await buildModel();
        this.syncNetworks();
    }

    syncNetworks() {
        const activeParams = this.activeNetwork!.getParameters();
        this.targetNetwork!.setParameters(activeParams);
    }

    updateNetwork() {
        this.activeNetwork!.beginBatch();

        const batch = this.experience.sample(BATCH_SIZE);
        for (let i = 0, len = batch.length; i < len; ++i) {
            const sample = batch[i];
            let target = sample.reward;
            if (!sample.done) {
                const qMax = Math.max(...this.targetNetwork!.pred(sample.nextState));
                target += GAMMA * qMax;
            }
            const q = this.activeNetwork!.pred(sample.state);
            q[sample.action] = target;

            this.activeNetwork!.step(sample.state, q);
        }

        this.activeNetwork!.endBatch();
    }

    chooseAction(state: number[]) {
        const q = this.activeNetwork!.pred(state);
        return q[0] > q[1] ? 0 : 1;
    }

    explore(state: number[], epsilon: number) {
        if (Math.random() < epsilon) {
            return Math.random() < .5 ? 0 : 1;
        }
        return this.chooseAction(state);
    }

    train(
        env: CartPoleEnv,
        maxEpisodes = 250,
        maxSteps = 300,
        syncSteps = 100,
        epsilonStart = 1.0,
        epsilonFinal = 0.01,
        epsilonDecay = 0.995,
    ) {
        let totalSteps = 0;
        let epsilon = epsilonStart;
        for (let episode = 0; episode < maxEpisodes; ++episode) {
            let episodeReward = 0;
            env.reset();
            let state = [...env.state];
            for (let step = 0; step < maxSteps; ++step) {
                const action = this.explore(state, epsilon);
                const [nextState, reward, done] = env.step(action);
                this.experience.add({state, nextState, action, reward, done});
                state = nextState;
                episodeReward += reward;
                totalSteps += 1;

                if (this.experience.filled()) {
                    this.updateNetwork();
                    if (epsilon > epsilonFinal) {
                        epsilon *= epsilonDecay;
                    } else {
                        epsilon = epsilonFinal;
                    }
                    if (totalSteps % syncSteps === 0) {
                        this.syncNetworks();
                    }
                }

                if (done) {
                    console.log('#' + episode, episodeReward, this.activeNetwork!.avgLoss);
                    break;
                }
            }
        }
    }

    exportJson() {
        return this.activeNetwork!.getParameters();
    }

    importJson(json: number[]) {
        this.activeNetwork!.setParameters(json);
        this.syncNetworks();
    }

}