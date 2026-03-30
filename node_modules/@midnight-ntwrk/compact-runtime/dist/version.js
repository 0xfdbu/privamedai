import { CompactError } from './error.js';
import { MAX_FIELD as OCRT_MAX_FIELD } from './constants.js';
export const versionString = "0.15.0";
export const checkRuntimeVersion = (expectedRuntimeVersionString) => {
    const expectedRuntimeVersion = expectedRuntimeVersionString.split('-')[0].split('.').map(Number);
    const actualRuntimeVersion = versionString.split('-')[0].split('.').map(Number);
    if (expectedRuntimeVersion[0] !== actualRuntimeVersion[0]
        || (actualRuntimeVersion[0] === 0 && expectedRuntimeVersion[1] !== actualRuntimeVersion[1])
        || expectedRuntimeVersion[1] > actualRuntimeVersion[1]
        || (expectedRuntimeVersion[1] === actualRuntimeVersion[1] && expectedRuntimeVersion[2] > actualRuntimeVersion[2])) {
        throw new CompactError(`Version mismatch: compiled code expects ${expectedRuntimeVersionString}, runtime is ${versionString}`);
    }
    const MAX_FIELD = 52435875175126190479447740508185965837690552500527637822603658699938581184512n;
    if (MAX_FIELD !== OCRT_MAX_FIELD) {
        throw new CompactError(`Maximum field mismatch: compiled code uses ${MAX_FIELD}, runtime uses ${OCRT_MAX_FIELD}`);
    }
};
//# sourceMappingURL=version.js.map