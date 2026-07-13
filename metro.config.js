const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const emptyShim = path.resolve(__dirname, 'shims/empty.js');

// @anthropic-ai/sdk가 참조하는 node 내장 모듈을 빈 셰임으로 대체 (RN에서는 사용되지 않는 코드 경로)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('node:')) {
    return { type: 'sourceFile', filePath: emptyShim };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
