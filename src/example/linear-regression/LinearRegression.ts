import {defineComponent, onMounted, ref} from 'vue';
import {add, backward, forward, minus, mul, pow, variable, zeroGrad} from '../../common/ml/auto-grad';
import Renderer from '../../common/render/Renderer';
import {gaussianRandom, random, shuffleArray} from '../../common/utils/random';

const WIDTH = 800;
const HEIGHT = 600;

export default defineComponent({
    setup() {
        const canvas = ref<HTMLCanvasElement>();
        let renderer: Renderer;
        let lossValue = ref(0);

        // ===========================================================

        function makeFakeData(num: number,
                              w: number,
                              b: number,
                              xLow: number,
                              xHigh: number,
                              noise: number
        ): [number, number][] {
            const ret: [number, number][] = [];
            for (let i = num; i--;) {
                const x = random(xLow, xHigh);
                const y = w * x + b + (gaussianRandom() - .5) * noise;
                ret.push([x, y]);
            }
            return ret;
        }

        const wReal = -.3;
        const bReal = 2;
        const xRange = 10;
        const fakeData = makeFakeData(80, wReal, bReal, -xRange, xRange, .5);

        const w = variable(Math.random());
        const b = variable(Math.random());
        const x = variable();
        const yPred = add(mul(w, x), b);
        const yTrue = variable();
        const loss = pow(minus(yPred, yTrue), 2);

        const lr = 0.01;
        const iter = 300;
        const batchSize = 30;
        let lossAvg = 0;
        for (let i = 0; i < iter; ++i) {
            let wGrad = 0;
            let bGrad = 0;
            lossAvg = 0;

            shuffleArray(fakeData, batchSize);
            for (let j = 0; j < batchSize; ++j) {
                const point = fakeData[j];

                x.value = point[0];
                yTrue.value = point[1];

                forward(loss);
                zeroGrad(loss);
                loss.grad = 1;
                backward(loss);

                wGrad += w.grad;
                bGrad += b.grad;
                lossAvg += loss.value;
            }

            wGrad /= batchSize;
            bGrad /= batchSize;
            w.value -= wGrad * lr;
            b.value -= bGrad * lr;
            lossAvg /= batchSize;
        }

        lossValue.value = lossAvg;

        // ===========================================================

        onMounted(function () {
            renderer = new Renderer(canvas.value);
            renderer.resizeCanvas(WIDTH, HEIGHT);
            render();
        });

        function render() {
            renderer.clear(1, 1, 1, 1);

            renderer.setZoom(Math.max(WIDTH, HEIGHT) / xRange / 2);
            const pointSize = 5 / renderer.state.zoom;

            renderer.setColor(0, 0, 0, .5);
            renderer.drawLine(-WIDTH / 2, 0, WIDTH / 2, 0);
            renderer.drawLine(0, -HEIGHT / 2, 0, HEIGHT / 2);

            renderer.setColor(1, 0, 0, 1);
            fakeData.forEach(point => {
                renderer.drawRect(renderer.BLANK_WHITE, point[0] - pointSize / 2, point[1] - pointSize / 2, pointSize, pointSize);
            });

            renderer.setColor(0, 0, 1, 1);
            const x0 = -xRange;
            x.value = x0;
            forward(yPred);
            const y0 = yPred.value;
            const x1 = xRange;
            x.value = x1;
            forward(yPred);
            const y1 = yPred.value;
            renderer.drawLine(x0, y0, x1, y1);

            renderer.flush();
        }

        return {canvas, lossValue};
    }
});