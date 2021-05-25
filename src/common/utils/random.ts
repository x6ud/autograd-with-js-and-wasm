export function random(min: number, max: number) {
    if (max < min) {
        throw new Error('Parameter max should not be less than min.');
    }
    return Math.random() * (max - min) + min;
}

export function randomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (max < min) {
        throw new Error('Parameter max should not be less than min.');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomIntExclude(min: number, max: number, exclude: number[]) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (max < min) {
        throw new Error('Parameter max should not be less than min.');
    }
    const candidate: number[] = [];
    for (let i = min; i <= max; ++i) {
        if (!exclude.includes(i)) {
            candidate.push(i);
        }
    }
    if (candidate.length === 0) {
        throw new Error('No candidate number.');
    }
    return candidate[randomInt(0, candidate.length - 1)];
}

export function randomIntTryExclude(min: number, max: number, exclude: number[]) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (max < min) {
        throw new Error('Parameter max should not be less than min.');
    }
    const candidate: number[] = [];
    for (let i = min; i <= max; ++i) {
        if (!exclude.includes(i)) {
            candidate.push(i);
        }
    }
    if (candidate.length === 0) {
        return randomInt(min, max);
    }
    return candidate[randomInt(0, candidate.length - 1)];
}

export function randomlySelectOne<T>(arr: T[]): T | undefined {
    if (arr.length) {
        return arr[randomInt(0, arr.length - 1)];
    }
    return undefined;
}

export function shuffleArray<T>(arr: T[], len = arr.length): T[] {
    for (let i = 0, last = len - 1; i < last; ++i) {
        const j = randomInt(i, last);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function gaussianRandom() {
    const u1 = 1 - Math.random();
    const u2 = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
}
