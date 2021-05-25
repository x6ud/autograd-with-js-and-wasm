import {AutoGradNode} from '../../auto-grad';

export default interface NNLayer {

    outs: AutoGradNode[];
    parameters: AutoGradNode[];

}
