import {defineComponent, onMounted, onUnmounted, ref} from 'vue';
import Renderer from '../../common/render/Renderer';
import CartPoleEnv from './CartPoleEnv';
import dqnAgentTrainedData from './dqn-agent-trained-data.json';
import DqnAgent from './DqnAgent';

const WIDTH = 800;
const HEIGHT = 600;

export default defineComponent({
    setup() {
        const canvas = ref<HTMLCanvasElement>();
        let renderer: Renderer;
        const score = ref(0);

        let tid: NodeJS.Timeout;

        onMounted(async function () {
            renderer = new Renderer(canvas.value);
            renderer.resizeCanvas(WIDTH, HEIGHT);

            // ===========================================================

            const env = new CartPoleEnv();
            env.reset();

            const agent = (window as any).agent = new DqnAgent();
            await agent.init();
            agent.importJson(dqnAgentTrainedData);
            // agent.train(env); // this takes a long time

            tid = setInterval(() => {
                score.value += 1;
                const action = agent.chooseAction(env.state);
                const [state, reward, done] = env.step(action);
                env.render(renderer);
                if (done) {
                    env.reset();
                    score.value = 0;
                }
            }, 1000 * env.tau);

            // ===========================================================
        });

        onUnmounted(function () {
            clearInterval(tid);
        });

        return {canvas, score};
    }
});