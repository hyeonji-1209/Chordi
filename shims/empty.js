// Metro shim: node 내장 모듈(node:fs 등)을 빈 모듈로 대체.
// @anthropic-ai/sdk는 apiKey를 직접 넘기면 이 모듈들을 실제로 호출하지 않는다.
module.exports = {};
