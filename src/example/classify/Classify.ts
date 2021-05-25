import {defineComponent, onMounted, onUnmounted, ref} from 'vue';
import * as dense from '../../common/ml/wasm/dense';
import Renderer from '../../common/render/Renderer';
import {random, shuffleArray} from '../../common/utils/random';

const WIDTH = 800;
const HEIGHT = 600;

export default defineComponent({
    setup() {
        const canvas = ref<HTMLCanvasElement>();
        const turn = ref(0);
        const loss = ref(0);
        let renderer: Renderer;

        let tid: NodeJS.Timeout;

        onMounted(async function () {
            renderer = new Renderer(canvas.value);
            renderer.resizeCanvas(WIDTH, HEIGHT);

            // ===========================================================

            function makeData(num: number, minX: number, maxX: number, minY: number, maxY: number) {
                const ret: number[][] = [];
                for (let i = num; i--;) {
                    const x = random(minX, maxX);
                    const y = random(minY, maxY);
                    let label = 0;
                    if (Math.sin(x / (maxX - minX) * Math.PI) > 0) {
                        label += 1;
                    }
                    if (Math.sin(y / (maxY - minY) * Math.PI) > 0) {
                        label += 1;
                    }
                    ret.push([x, y, label]);
                }
                return ret;
            }

            const data = makeData(500, -WIDTH / 2, WIDTH / 2, -HEIGHT / 2, HEIGHT / 2);

            const model = await dense.model(
                dense.vector(2),
                [
                    dense.linear(16),
                    dense.reLU(),
                    dense.linear(3),
                    dense.softmax()
                ],
                dense.mseLoss
            );
            const batchSize = Math.min(50, data[0].length);

            function doEpoch() {
                turn.value += 1;
                shuffleArray(data);

                model.beginBatch();
                for (let i = 0; i < batchSize; ++i) {
                    const d = data[i];
                    model.step(
                        [
                            d[0] / (WIDTH / 2),
                            d[1] / (HEIGHT / 2)
                        ],
                        [
                            d[2] === 0 ? 1 : 0,
                            d[2] === 1 ? 1 : 0,
                            d[2] === 2 ? 1 : 0
                        ]
                    );
                }
                model.endBatch();
            }

            // ===========================================================

            function render() {
                renderer.clear(1, 1, 1, 1);

                const detX = 20;
                const detY = 20;
                for (let x = -WIDTH / 2; x <= WIDTH / 2; x += detX) {
                    for (let y = -HEIGHT / 2; y <= HEIGHT / 2; y += detY) {
                        const label = model.pred([(x + detX / 2) / (WIDTH / 2), (y + detY / 2) / (HEIGHT / 2)]);
                        renderer.setColor(label[0], label[1], label[2], 1);
                        renderer.drawRect(renderer.BLANK_WHITE, x, y, detX, detY);
                    }
                }

                data.forEach(data => {
                    const x = data[0];
                    const y = data[1];
                    const label = data[2];
                    renderer.setColor(1, 1, 1, 1);
                    switch (label) {
                        case 0:
                            renderer.setColor(1, 0, 0, 1);
                            break;
                        case 1:
                            renderer.setColor(0, 1, 0, 1);
                            break;
                        case 2:
                            renderer.setColor(0, 0, 1, 1);
                            break;
                    }
                    renderer.drawRect(renderer.BLANK_WHITE, x - 1, y - 1, 2, 2);
                });

                renderer.flush();
            }

            // ===========================================================

            tid = setInterval(function () {
                for (let i = 0; i < 50; ++i) {
                    doEpoch();
                }
                render();
                loss.value = model.avgLoss;
            }, 1000 / 4);
        });

        onUnmounted(function () {
            clearInterval(tid);
        });

        return {canvas, turn, loss};
    }
});