// https://github.com/openai/gym/blob/master/gym/envs/classic_control/cartpole.py

import Renderer from '../../common/render/Renderer';
import {random} from '../../common/utils/random';

export default class CartPoleEnv {

    gravity = 9.8;
    massCart = 1.0;
    massPole = 0.1;
    totalMass = this.massCart + this.massPole;
    length = 0.5;
    poleMassLength = this.massPole * this.length;
    forceMag = 10.0;
    tau = 0.02;

    thetaThresholdRadians = 12 * 2 * Math.PI / 360;
    xThreshold = 2.4;

    state: [number, number, number, number] = [0, 0, 0, 0];

    stepsBeyondDone: number = -1;

    reset() {
        for (let i = this.state.length; i--;) {
            this.state[i] = random(-0.05, 0.05);
        }
    }

    step(action: number, linear: boolean = false): [number[], number, boolean] {
        let [x, xDot, theta, thetaDot] = this.state;
        if (!linear) {
            action = action > 0 ? 1 : -1;
        }
        const force = action * this.forceMag;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        const temp = (force + this.poleMassLength * thetaDot ** 2 * sinTheta) / this.totalMass;
        const thetaAcc = (this.gravity * sinTheta - cosTheta * temp) / (this.length * (4.0 / 3.0 - this.massPole * cosTheta ** 2 / this.totalMass));
        const xAcc = temp - this.poleMassLength * thetaAcc * cosTheta / this.totalMass;

        x = x + this.tau * xDot;
        xDot = xDot + this.tau * xAcc;
        theta = theta + this.tau * thetaDot;
        thetaDot = thetaDot + this.tau * thetaAcc;

        const done =
            x < -this.xThreshold
            || x > this.xThreshold
            || theta < -this.thetaThresholdRadians
            || theta > this.thetaThresholdRadians;

        let reward = 0;
        if (!done) {
            reward = 1.0;
        } else if (this.stepsBeyondDone < 0) {
            this.stepsBeyondDone = 0;
            reward = 1.0;
        } else {
            this.stepsBeyondDone += 1;
            reward = 0.0;
        }

        this.state = [x, xDot, theta, thetaDot];

        return [[...this.state], reward, done];
    }

    render(renderer: Renderer) {
        const poleLen = this.length;
        const cartWidth = 50;
        const cartHeight = 30;

        const scale = renderer.state.width / (this.xThreshold * 2);

        const x = this.state[0] * scale;
        const theta = this.state[2];

        const l = x - cartWidth / 2;
        const r = l + cartWidth;
        const b = 0;
        const t = b + cartHeight;

        const cos = Math.cos(-theta);
        const sin = Math.sin(-theta);
        const px = 0;
        const py = poleLen * scale;
        const px1 = px * cos - py * sin;
        const py1 = px * sin + py * cos;
        const cx = x;
        const cy = cartHeight / 2;

        renderer.clear(0, 0, 0, 1);
        renderer.drawLine(l, b, r, b);
        renderer.drawLine(l, b, l, t);
        renderer.drawLine(l, t, r, t);
        renderer.drawLine(r, b, r, t);
        renderer.drawLine(cx, cy, px1 + cx, py1 + cy);
        renderer.flush();
    }

}
